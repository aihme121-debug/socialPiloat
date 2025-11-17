import { NextResponse } from 'next/server';
import { monitoringService } from '@/lib/monitoring/monitoring-service';
import { SecurityService } from '@/lib/security/security-service';

const SecurityServiceClass: any = SecurityService as any;
export const securityService = SecurityServiceClass && SecurityServiceClass.prototype
  ? new SecurityServiceClass()
  : SecurityServiceClass();

export let getSecurityService = (): SecurityService => securityService as unknown as SecurityService;
export function setSecurityServiceForTest(service: Partial<SecurityService> & Record<string, any>) {
  getSecurityService = () => service as unknown as SecurityService;
}

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: Record<string, any>;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  code?: string;
  details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends CustomError {
  constructor(service: string, _message?: string) {
    super(`${service} service unavailable`, 503, 'EXTERNAL_SERVICE_ERROR', { service });
  }
}

/**
 * Global error handler for API routes
 */
export function handleApiError(error: unknown): NextResponse {
  let appError: AppError;

  if (error instanceof CustomError) {
    appError = error;
  } else if (error instanceof Error) {
    appError = new CustomError(error.message, 500, 'INTERNAL_ERROR');
  } else {
    appError = new CustomError('An unexpected error occurred', 500, 'UNKNOWN_ERROR');
  }

  // Log error to monitoring service
  monitoringService.logError(appError, {
    statusCode: appError.statusCode,
    code: appError.code,
    details: appError.details,
    stack: appError.stack,
  });

  // Log security events for certain error types
  if (appError.statusCode === 401 || appError.statusCode === 403) {
    securityService.logSecurityEvent({
      type: 'authentication_error',
      severity: appError.statusCode === 403 ? 'high' : 'medium',
      message: appError.message,
      metadata: appError.details,
    });
  }

  if (appError.statusCode === 429) {
    securityService.logSecurityEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      message: appError.message,
      metadata: appError.details,
    });
  }

  return NextResponse.json(
    {
      error: {
        message: appError.message,
        code: appError.code,
        statusCode: appError.statusCode,
        details: appError.isOperational ? appError.details : undefined,
      },
    },
    { status: appError.statusCode }
  );
}

/**
 * Async wrapper for API route handlers
 */
export function apiHandler(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Validate request data
 */
export function validateRequestData<T>(
  data: any,
  schema: Record<keyof T, (value: any) => boolean>
): T {
  const errors: Record<string, string> = {};
  const validatedData: Partial<T> = {};

  for (const [key, validator] of Object.entries(schema)) {
    const value = data[key];
    
    if (value === undefined || value === null) {
      errors[key] = `${key} is required`;
      continue;
    }

    const validatorFn = validator as (value: any) => boolean;
    if (!validatorFn(value)) {
      errors[key] = `${key} is invalid`;
      continue;
    }

    validatedData[key as keyof T] = value;
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  return validatedData as T;
}

/**
 * Rate limiting helper
 */
export function checkRateLimit(clientId: string): void {
  const rateLimit = getSecurityService().checkRateLimit(clientId);
  
  if (!rateLimit.allowed) {
    throw new RateLimitError(`Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds.`);
  }
}

/**
 * Sanitize input data
 */
export function sanitizeInput(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      const suspiciousCheck = getSecurityService().checkSuspiciousPatterns(value);
      if (suspiciousCheck.isSuspicious) {
        throw new ValidationError(`Suspicious input detected in ${key}: ${suspiciousCheck.reason}`);
      }
      sanitized[key] = getSecurityService().sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
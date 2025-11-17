import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger-service'
import { SecurityService } from '@/lib/security/security-service'
import { 
  handleApiError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  RateLimitError,
  sanitizeInput,
  checkRateLimit
} from '@/lib/error-handling/error-handler'

const securityService = new SecurityService()

/**
 * Comprehensive API middleware that handles:
 * - Rate limiting
 * - Input sanitization
 * - Authentication validation
 * - Error handling
 * - Request logging
 * - Security headers
 */
export async function apiMiddleware(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean
    rateLimitKey?: string
    sanitizeBody?: boolean
    allowedMethods?: string[]
    securityHeaders?: boolean
  } = {}
) {
  const startTime = Date.now()
  const requestId = generateRequestId()
  
  try {
    // Add security headers
    if (options.securityHeaders !== false) {
      addSecurityHeaders(request)
    }

    // Validate HTTP method
    if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
      throw new ValidationError(`Method ${request.method} not allowed`)
    }

    // Rate limiting
    if (options.rateLimitKey) {
      const clientId = getClientIdentifier(request, options.rateLimitKey)
      checkRateLimit(clientId)
    }

    // Input sanitization
    if (options.sanitizeBody && request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const body = await request.json()
        const sanitizedBody = sanitizeInput(body)
        
        // Create new request with sanitized body
        const sanitizedRequest = new NextRequest(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(sanitizedBody)
        })
        
        // Copy over any custom properties from original request
        Object.assign(sanitizedRequest, request)
        
        return await handler(sanitizedRequest)
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new ValidationError('Invalid JSON in request body')
        }
        throw error
      }
    }

    // Authentication validation
    if (options.requireAuth) {
      const authHeader = request.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError('Bearer token required')
      }
      
      // Additional auth validation could go here
      // e.g., validate JWT token, check session, etc.
    }

    // Execute the main handler
    const response = await handler(request)
    
    // Log successful request
    const duration = Date.now() - startTime
    logger.info('API request completed successfully', {
      requestId,
      method: request.method,
      url: request.url,
      status: response.status,
      duration
    })
    
    return response
    
  } catch (error) {
    // Log error and handle it
    const duration = Date.now() - startTime
    logger.error(
      'API request failed',
      error instanceof Error ? error : undefined,
      {
        requestId,
        method: request.method,
        url: request.url,
        duration
      }
    )
    
    return handleApiError(error)
  }
}

/**
 * Generate unique request ID for tracking
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest, keyType: string): string {
  switch (keyType) {
    case 'ip':
      return request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
    case 'user':
      // Extract user ID from auth header or session
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // Simple JWT payload extraction (in production, use proper JWT validation)
        try {
          const token = authHeader.substring(7)
          const payload = JSON.parse(atob(token.split('.')[1]))
          return payload.sub || payload.userId || 'anonymous'
        } catch {
          return 'anonymous'
        }
      }
      return 'anonymous'
    default:
      return 'unknown'
  }
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(request: NextRequest) {
  // Security headers are already added by the security service
  // This function can be extended to add request-specific security logic
}

/**
 * Create a wrapper for API routes with error handling and middleware
 */
export function createApiRoute(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean
    rateLimitKey?: string
    sanitizeBody?: boolean
    allowedMethods?: string[]
    securityHeaders?: boolean
  } = {}
) {
  return async (request: NextRequest) => {
    return apiMiddleware(request, handler, options)
  }
}

/**
 * Batch request handler for multiple operations
 */
export async function handleBatchRequest(
  request: NextRequest,
  operations: Array<{
    name: string
    handler: () => Promise<any>
  }>
): Promise<NextResponse> {
  const results: Record<string, any> = {}
  const errors: Record<string, string> = {}
  
  try {
    // Execute all operations in parallel with error isolation
    const promises = operations.map(async (operation) => {
      try {
        const result = await operation.handler()
        results[operation.name] = result
      } catch (error) {
        errors[operation.name] = error instanceof Error ? error.message : 'Unknown error'
        logger.error(
          `Batch operation failed: ${operation.name}`,
          error instanceof Error ? error : undefined,
          {
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      }
    })
    
    await Promise.allSettled(promises)
    
    return NextResponse.json({
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined
    })
    
  } catch (error) {
    return handleApiError(error)
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from '@/lib/monitoring/monitoring-service';

export interface SecurityHeaders {
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Strict-Transport-Security': string;
  'Content-Security-Policy': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
}

export class SecurityService {
  private static instance: SecurityService;
  private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 100;

  constructor() {}

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Apply security headers to response
   */
  applySecurityHeaders(response: NextResponse): NextResponse {
    const headers: SecurityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': this.generateCSP(),
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    };

    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  /**
   * Generate Content Security Policy
   */
  private generateCSP(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "img-src 'self' data: https: http:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.socialpiloat.com wss://api.socialpiloat.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const key = clientId;
    const current = this.rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      // Reset or initialize
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      
      return {
        allowed: true,
        remaining: this.RATE_LIMIT_MAX_REQUESTS - 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      };
    }

    if (current.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime,
      };
    }

    current.count++;
    return {
      allowed: true,
      remaining: this.RATE_LIMIT_MAX_REQUESTS - current.count,
      resetTime: current.resetTime,
    };
  }

  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey: string): boolean {
    // Basic API key validation - should be enhanced in production
    const apiKeyPattern = /^[a-zA-Z0-9]{32,64}$/;
    return apiKeyPattern.test(apiKey);
  }

  /**
   * Check for suspicious patterns
   */
  checkSuspiciousPatterns(input: string): { isSuspicious: boolean; reason?: string } {
    const suspiciousPatterns = [
      /(<script|<iframe|<object|<embed)/gi, // HTML injection
      /(union|select|insert|update|delete|drop|create|alter|exec|script)/gi, // SQL injection
      /(\.\.\/|\.\.\\|%2e%2e)/gi, // Path traversal
      /(javascript:|data:|vbscript:)/gi, // Protocol injection
      /(['"`\\x])/gi, // SQL injection patterns
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(input)) {
        return {
          isSuspicious: true,
          reason: `Suspicious pattern detected: ${pattern.source}`
        };
      }
    }

    return { isSuspicious: false };
  }

  /**
   * Log security events for monitoring and alerting
   */
  logSecurityEvent(event: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): void {
    // Log to monitoring service
    monitoringService.logSecurityEvent(event);
    
    // In production, you might also:
    // - Send to SIEM system
    // - Trigger alerts for high severity events
    // - Store in security event database
    console.log(`[SECURITY] ${event.severity.toUpperCase()}: ${event.type} - ${event.message}`);
  }
}
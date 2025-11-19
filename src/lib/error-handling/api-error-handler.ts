import { NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger-service'

export interface APIError {
  message: string
  code: string
  statusCode: number
  details?: any
}

export class APIErrorHandler {
  static handle(error: any, context?: string): NextResponse {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Log the error
    logger.error(`API Error${context ? ` in ${context}` : ''}`, error instanceof Error ? error : undefined, {
      errorId,
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    // Handle different error types
    if (error instanceof Error) {
      if (error.message.includes('Prisma')) {
        return this.handleDatabaseError(error, errorId)
      }
      if (error.message.includes('fetch')) {
        return this.handleNetworkError(error, errorId)
      }
      if (error.message.includes('validation')) {
        return this.handleValidationError(error, errorId)
      }
    }

    // Default error response
    return NextResponse.json(
      {
        error: {
          id: errorId,
          message: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }

  private static handleDatabaseError(error: Error, errorId: string): NextResponse {
    return NextResponse.json(
      {
        error: {
          id: errorId,
          message: 'Database operation failed',
          code: 'DATABASE_ERROR',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }

  private static handleNetworkError(error: Error, errorId: string): NextResponse {
    return NextResponse.json(
      {
        error: {
          id: errorId,
          message: 'External service unavailable',
          code: 'NETWORK_ERROR',
          timestamp: new Date().toISOString()
        }
      },
      { status: 503 }
    )
  }

  private static handleValidationError(error: Error, errorId: string): NextResponse {
    return NextResponse.json(
      {
        error: {
          id: errorId,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      },
      { status: 400 }
    )
  }

  static success(data: any, statusCode: number = 200): NextResponse {
    return NextResponse.json(
      {
        success: true,
        data,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    )
  }

  static error(message: string, code: string, statusCode: number = 400, details?: any): NextResponse {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    logger.warn(`API Error: ${message}`, { code, details })

    return NextResponse.json(
      {
        error: {
          id: errorId,
          message,
          code,
          timestamp: new Date().toISOString(),
          details
        }
      },
      { status: statusCode }
    )
  }
}
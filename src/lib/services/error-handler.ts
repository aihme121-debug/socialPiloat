import { logger } from '@/lib/logger'

export interface ErrorDetails {
  message: string
  code?: string
  context?: string
  userId?: string
  timestamp: string
  stack?: string
  metadata?: Record<string, any>
}

export interface UserFriendlyError {
  title: string
  message: string
  action?: string
  severity: 'error' | 'warning' | 'info'
  duration?: number
}

export class FacebookIntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public userFriendly?: UserFriendlyError
  ) {
    super(message)
    this.name = 'FacebookIntegrationError'
  }
}

export class ErrorHandlerService {
  private static instance: ErrorHandlerService
  
  private constructor() {}
  
  static getInstance(): ErrorHandlerService {
    if (!ErrorHandlerService.instance) {
      ErrorHandlerService.instance = new ErrorHandlerService()
    }
    return ErrorHandlerService.instance
  }

  handleError(error: unknown, context?: string, userId?: string): UserFriendlyError {
    const errorDetails = this.parseError(error, context, userId)
    
    // Log the error
    logger.error('Error occurred', {
      error: errorDetails,
      context,
      userId
    })

    // Return user-friendly error
    return this.getUserFriendlyError(errorDetails)
  }

  private parseError(error: unknown, context?: string, userId?: string): ErrorDetails {
    const timestamp = new Date().toISOString()
    
    if (error instanceof FacebookIntegrationError) {
      return {
        message: error.message,
        code: error.code,
        context,
        userId,
        timestamp,
        stack: error.stack,
        metadata: error.details
      }
    }
    
    if (error instanceof Error) {
      return {
        message: error.message,
        context,
        userId,
        timestamp,
        stack: error.stack
      }
    }
    
    if (typeof error === 'string') {
      return {
        message: error,
        context,
        userId,
        timestamp
      }
    }
    
    return {
      message: 'An unexpected error occurred',
      context,
      userId,
      timestamp,
      metadata: error
    }
  }

  private getUserFriendlyError(errorDetails: ErrorDetails): UserFriendlyError {
    // Facebook API specific errors
    if (errorDetails.code?.startsWith('FB_')) {
      return this.handleFacebookError(errorDetails)
    }
    
    // Database errors
    if (errorDetails.code?.startsWith('DB_')) {
      return this.handleDatabaseError(errorDetails)
    }
    
    // Network errors
    if (errorDetails.code?.startsWith('NET_')) {
      return this.handleNetworkError(errorDetails)
    }
    
    // Authentication errors
    if (errorDetails.code?.startsWith('AUTH_')) {
      return this.handleAuthError(errorDetails)
    }
    
    // Generic errors
    return {
      title: 'Something went wrong',
      message: errorDetails.message || 'An unexpected error occurred. Please try again.',
      action: 'Please refresh the page and try again',
      severity: 'error',
      duration: 5000
    }
  }

  private handleFacebookError(errorDetails: ErrorDetails): UserFriendlyError {
    switch (errorDetails.code) {
      case 'FB_INVALID_TOKEN':
        return {
          title: 'Facebook Connection Expired',
          message: 'Your Facebook connection has expired. Please reconnect your account.',
          action: 'Reconnect Facebook Account',
          severity: 'warning',
          duration: 10000
        }
      
      case 'FB_INSUFFICIENT_PERMISSIONS':
        return {
          title: 'Insufficient Permissions',
          message: 'Your Facebook account doesn\'t have the required permissions. Please check your page roles.',
          action: 'Check Facebook Page Permissions',
          severity: 'warning',
          duration: 8000
        }
      
      case 'FB_PAGE_NOT_FOUND':
        return {
          title: 'Page Not Found',
          message: 'The Facebook page you\'re trying to access no longer exists or you don\'t have access to it.',
          action: 'Select a different page',
          severity: 'info',
          duration: 6000
        }
      
      case 'FB_RATE_LIMIT':
        return {
          title: 'Rate Limit Exceeded',
          message: 'You\'ve made too many requests to Facebook. Please wait a few minutes before trying again.',
          action: 'Wait and retry later',
          severity: 'warning',
          duration: 10000
        }
      
      case 'FB_WEBHOOK_ERROR':
        return {
          title: 'Webhook Configuration Error',
          message: 'There was an issue setting up webhooks for your Facebook page. Please check your webhook URL.',
          action: 'Check webhook configuration',
          severity: 'error',
          duration: 8000
        }
      
      default:
        return {
          title: 'Facebook Integration Error',
          message: 'There was an issue with your Facebook integration. Please try again.',
          action: 'Retry the operation',
          severity: 'error',
          duration: 6000
        }
    }
  }

  private handleDatabaseError(errorDetails: ErrorDetails): UserFriendlyError {
    switch (errorDetails.code) {
      case 'DB_CONNECTION_FAILED':
        return {
          title: 'Database Connection Failed',
          message: 'Unable to connect to the database. Some features may be temporarily unavailable.',
          action: 'Please try again in a few moments',
          severity: 'error',
          duration: 8000
        }
      
      case 'DB_QUERY_FAILED':
        return {
          title: 'Database Query Failed',
          message: 'There was an issue retrieving your data. Please refresh the page and try again.',
          action: 'Refresh the page',
          severity: 'error',
          duration: 6000
        }
      
      case 'DB_ENCRYPTION_ERROR':
        return {
          title: 'Data Encryption Error',
          message: 'There was an issue securing your data. Please contact support if this persists.',
          action: 'Contact support',
          severity: 'error',
          duration: 10000
        }
      
      default:
        return {
          title: 'Database Error',
          message: 'There was an issue with data storage. Please try again.',
          action: 'Retry the operation',
          severity: 'error',
          duration: 6000
        }
    }
  }

  private handleNetworkError(errorDetails: ErrorDetails): UserFriendlyError {
    switch (errorDetails.code) {
      case 'NET_TIMEOUT':
        return {
          title: 'Connection Timeout',
          message: 'The request took too long to complete. Please check your internet connection and try again.',
          action: 'Check connection and retry',
          severity: 'warning',
          duration: 8000
        }
      
      case 'NET_OFFLINE':
        return {
          title: 'No Internet Connection',
          message: 'You appear to be offline. Please check your internet connection.',
          action: 'Check internet connection',
          severity: 'warning',
          duration: 10000
        }
      
      case 'NET_SERVER_ERROR':
        return {
          title: 'Server Error',
          message: 'Our servers are experiencing issues. Please try again in a few moments.',
          action: 'Wait and retry',
          severity: 'error',
          duration: 8000
        }
      
      default:
        return {
          title: 'Network Error',
          message: 'There was a network issue. Please check your connection and try again.',
          action: 'Check connection and retry',
          severity: 'warning',
          duration: 6000
        }
    }
  }

  private handleAuthError(errorDetails: ErrorDetails): UserFriendlyError {
    switch (errorDetails.code) {
      case 'AUTH_UNAUTHORIZED':
        return {
          title: 'Unauthorized',
          message: 'You don\'t have permission to perform this action. Please log in again.',
          action: 'Log in again',
          severity: 'error',
          duration: 6000
        }
      
      case 'AUTH_TOKEN_EXPIRED':
        return {
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again to continue.',
          action: 'Log in again',
          severity: 'warning',
          duration: 8000
        }
      
      default:
        return {
          title: 'Authentication Error',
          message: 'There was an issue with authentication. Please log in again.',
          action: 'Log in again',
          severity: 'error',
          duration: 6000
        }
    }
  }

  createError(code: string, message: string, details?: any, userFriendly?: UserFriendlyError): FacebookIntegrationError {
    return new FacebookIntegrationError(message, code, details, userFriendly)
  }
}

export const errorHandler = ErrorHandlerService.getInstance()
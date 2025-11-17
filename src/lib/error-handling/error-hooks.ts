import { useState, useCallback, useEffect } from 'react'
import { logger } from '@/lib/logging/logger-service'

export interface ErrorState {
  hasError: boolean
  error: Error | null
  isRetrying: boolean
  retryCount: number
}

export interface ErrorHandlerOptions {
  maxRetries?: number
  retryDelay?: number
  showToast?: boolean
  logError?: boolean
  fallbackMessage?: string
  onError?: (error: Error) => void
  onRetry?: (attempt: number) => void
  onRecovery?: () => void
}

/**
 * Hook for handling errors in React components with retry logic
 */
export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    showToast = true,
    logError = true,
    fallbackMessage = 'Something went wrong',
    onError,
    onRetry,
    onRecovery
  } = options

  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    isRetrying: false,
    retryCount: 0
  })

  const handleError = useCallback((error: Error | unknown, context?: string) => {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    
    setErrorState(prev => ({
      hasError: true,
      error: errorObj,
      isRetrying: false,
      retryCount: prev.retryCount
    }))

    // Log error if enabled
    if (logError) {
      logger.error(
        context ? `${context}: ${errorObj.message}` : errorObj.message,
        errorObj,
        {
          details: errorObj.message,
          stack: errorObj.stack,
          context
        }
      )
    }

    // Call custom error handler
    if (onError) {
      onError(errorObj)
    }
  }, [logError, showToast, fallbackMessage, onError])

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (errorState.retryCount >= maxRetries) {
      setErrorState(prev => ({ ...prev, isRetrying: false }))
      return
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1
    }))

    // Call retry callback
    if (onRetry) {
      onRetry(errorState.retryCount + 1)
    }

    try {
      const result = await operation()
      
      // Success - reset error state
      setErrorState({
        hasError: false,
        error: null,
        isRetrying: false,
        retryCount: 0
      })

      // Call recovery callback
      if (onRecovery) {
        onRecovery()
      }

      return result
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      
      setErrorState(prev => ({
        ...prev,
        hasError: true,
        error: errorObj,
        isRetrying: false
      }))

      // Wait before allowing another retry
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      
      throw error
    }
  }, [errorState.retryCount, maxRetries, retryDelay, showToast, onRetry, onRecovery])

  const reset = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      isRetrying: false,
      retryCount: 0
    })
  }, [])

  return {
    errorState,
    handleError,
    retry,
    reset
  }
}

/**
 * Hook for handling async operations with automatic error handling and retry
 */
export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions & {
    immediate?: boolean
    dependencies?: React.DependencyList
  } = {}
) {
  const {
    immediate = true,
    dependencies = [],
    ...errorHandlerOptions
  } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { errorState, handleError, retry, reset } = useErrorHandler(errorHandlerOptions)

  const execute = useCallback(async () => {
    setIsLoading(true)
    reset()

    try {
      const result = await operation()
      setData(result)
      return result
    } catch (error) {
      handleError(error, `Async operation failed`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [operation, handleError, reset])

  const executeWithRetry = useCallback(async () => {
    return retry(async () => {
      setIsLoading(true)
      try {
        const result = await operation()
        setData(result)
        return result
      } finally {
        setIsLoading(false)
      }
    })
  }, [retry, operation])

  useEffect(() => {
    if (immediate) {
      execute().catch(() => {
        // Error is already handled by handleError
      })
    }
  }, [immediate, ...dependencies])

  return {
    data,
    isLoading,
    errorState,
    execute,
    executeWithRetry,
    retry: executeWithRetry
  }
}

/**
 * Hook for handling form submission with error handling
 */
export function useFormSubmit<T>(
  onSubmit: (data: T) => Promise<void>,
  options: ErrorHandlerOptions & {
    onSuccess?: () => void
    onError?: (error: Error) => void
  } = {}
) {
  const {
    onSuccess,
    onError,
    ...errorHandlerOptions
  } = options

  const [isSubmitting, setIsSubmitting] = useState(false)
  const { errorState, handleError, reset } = useErrorHandler({
    ...errorHandlerOptions,
    onError: (error) => {
      handleError(error, 'Form submission failed')
      if (onError) {
        onError(error)
      }
    }
  })

  const submit = useCallback(async (data: T) => {
    setIsSubmitting(true)
    reset()

    try {
      await onSubmit(data)
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      handleError(errorObj, 'Form submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [onSubmit, reset, handleError, onSuccess])

  return {
    isSubmitting,
    errorState,
    submit
  }
}
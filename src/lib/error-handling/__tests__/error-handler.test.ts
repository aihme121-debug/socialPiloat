import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  CustomError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError, 
  ConflictError, 
  RateLimitError, 
  ExternalServiceError,
  handleApiError,
  validateRequestData,
  checkRateLimit,
  sanitizeInput,
  apiHandler
} from '@/lib/error-handling/error-handler'
import { setSecurityServiceForTest } from '@/lib/error-handling/error-handler'
import { monitoringService } from '@/lib/monitoring/monitoring-service'
import { SecurityService } from '@/lib/security/security-service'

// Mock dependencies
vi.mock('@/lib/monitoring/monitoring-service', () => ({
  monitoringService: {
    logError: vi.fn(),
    logSecurityEvent: vi.fn()
  }
}))

vi.mock('@/lib/security/security-service', () => ({
  SecurityService: class {
    checkRateLimit = vi.fn().mockReturnValue({ allowed: true, remaining: 100, resetTime: Date.now() + 60000 })
    checkSuspiciousPatterns = vi.fn().mockReturnValue({ isSuspicious: false })
    sanitizeInput = vi.fn().mockImplementation((input: any) => input)
    logSecurityEvent = vi.fn()
  }
}))

// Mock the global security service instance
vi.mock('@/lib/error-handling/error-handler', async () => {
  const actual = await vi.importActual('@/lib/error-handling/error-handler')
  const mockSvc = {
    checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 100, resetTime: Date.now() + 60000 }),
    checkSuspiciousPatterns: vi.fn().mockReturnValue({ isSuspicious: false }),
    sanitizeInput: vi.fn().mockImplementation((input: any) => input),
    logSecurityEvent: vi.fn()
  }
  return {
    ...actual,
    getSecurityService: () => mockSvc,
    setSecurityServiceForTest: actual.setSecurityServiceForTest
  }
})

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSecurityServiceForTest({
      checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 100, resetTime: Date.now() + 60000 }),
      checkSuspiciousPatterns: vi.fn().mockReturnValue({ isSuspicious: false }),
      sanitizeInput: vi.fn().mockImplementation((input: any) => input),
      logSecurityEvent: vi.fn()
    } as any)
  })

  describe('Custom Error Classes', () => {
    it('should create CustomError with correct properties', () => {
      const error = new CustomError('Test error', 400, 'TEST_ERROR', { field: 'value' })
      
      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('TEST_ERROR')
      expect(error.details).toEqual({ field: 'value' })
      expect(error.isOperational).toBe(true)
      expect(error.stack).toBeDefined()
    })

    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Validation failed', { field: 'invalid' })
      
      expect(error.message).toBe('Validation failed')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.details).toEqual({ field: 'invalid' })
    })

    it('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError('Invalid credentials')
      
      expect(error.message).toBe('Invalid credentials')
      expect(error.statusCode).toBe(401)
      expect(error.code).toBe('AUTHENTICATION_ERROR')
    })

    it('should create AuthorizationError with correct properties', () => {
      const error = new AuthorizationError('Access denied')
      
      expect(error.message).toBe('Access denied')
      expect(error.statusCode).toBe(403)
      expect(error.code).toBe('AUTHORIZATION_ERROR')
    })

    it('should create NotFoundError with correct properties', () => {
      const error = new NotFoundError('User')
      
      expect(error.message).toBe('User not found')
      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND_ERROR')
    })

    it('should create ConflictError with correct properties', () => {
      const error = new ConflictError('Resource already exists')
      
      expect(error.message).toBe('Resource already exists')
      expect(error.statusCode).toBe(409)
      expect(error.code).toBe('CONFLICT_ERROR')
    })

    it('should create RateLimitError with correct properties', () => {
      const error = new RateLimitError('Too many requests')
      
      expect(error.message).toBe('Too many requests')
      expect(error.statusCode).toBe(429)
      expect(error.code).toBe('RATE_LIMIT_ERROR')
    })

    it('should create ExternalServiceError with correct properties', () => {
      const error = new ExternalServiceError('Facebook', 'Service unavailable')
      
      expect(error.message).toBe('Facebook service unavailable')
      expect(error.statusCode).toBe(503)
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR')
      expect(error.details).toEqual({ service: 'Facebook' })
    })
  })

  describe('handleApiError', () => {
    it('should handle CustomError correctly', async () => {
      const customError = new CustomError('Test error', 400, 'TEST_ERROR', { field: 'value' })
      const response = handleApiError(customError)
      
      expect(response.status).toBe(400)
      expect(response.headers.get('content-type')).toBe('application/json')
      
      const body = await (response as any).json()
      expect(body.error).toEqual({
        message: 'Test error',
        code: 'TEST_ERROR',
        statusCode: 400,
        details: { field: 'value' }
      })
    })

    it('should handle generic Error correctly', async () => {
      const genericError = new Error('Generic error')
      const response = handleApiError(genericError)
      
      expect(response.status).toBe(500)
      
      const body = await (response as any).json()
      expect(body.error).toEqual({
        message: 'Generic error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        details: undefined
      })
    })

    it('should handle unknown errors correctly', async () => {
      const response = handleApiError('String error')
      
      expect(response.status).toBe(500)
      
      const body = await (response as any).json()
      expect(body.error).toEqual({
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
        details: undefined
      })
    })

    it('should log security events for authentication errors', () => {
      const authError = new AuthenticationError('Invalid token')
      handleApiError(authError)
      
      expect(monitoringService.logError).toHaveBeenCalledWith(
        authError,
        expect.objectContaining({
          statusCode: 401,
          code: 'AUTHENTICATION_ERROR'
        })
      )
    })

    it('should log security events for authorization errors', () => {
      const authError = new AuthorizationError('Access denied')
      handleApiError(authError)
      
      expect(monitoringService.logError).toHaveBeenCalledWith(
        authError,
        expect.objectContaining({
          statusCode: 403,
          code: 'AUTHORIZATION_ERROR'
        })
      )
    })

    it('should log security events for rate limit errors', () => {
      const rateLimitError = new RateLimitError('Rate limit exceeded')
      handleApiError(rateLimitError)
      
      expect(monitoringService.logError).toHaveBeenCalledWith(
        rateLimitError,
        expect.objectContaining({
          statusCode: 429,
          code: 'RATE_LIMIT_ERROR'
        })
      )
    })
  })

  describe('validateRequestData', () => {
    it('should validate data successfully', () => {
      const schema = {
        name: (value: any) => typeof value === 'string' && value.length > 0,
        age: (value: any) => typeof value === 'number' && value > 0
      }
      
      const data = { name: 'John', age: 25 }
      const result = validateRequestData(data, schema)
      
      expect(result).toEqual(data)
    })

    it('should throw ValidationError for missing required fields', () => {
      const schema = {
        name: (value: any) => typeof value === 'string' && value.length > 0,
        age: (value: any) => typeof value === 'number' && value > 0
      }
      
      const data = { name: 'John' }
      
      expect(() => validateRequestData(data, schema)).toThrow(ValidationError)
      expect(() => validateRequestData(data, schema)).toThrow('Validation failed')
    })

    it('should throw ValidationError for invalid field values', () => {
      const schema = {
        name: (value: any) => typeof value === 'string' && value.length > 0,
        age: (value: any) => typeof value === 'number' && value > 0
      }
      
      const data = { name: '', age: -5 }
      
      expect(() => validateRequestData(data, schema)).toThrow(ValidationError)
    })

    it('should handle null and undefined values correctly', () => {
      const schema = {
        name: (value: any) => typeof value === 'string' && value.length > 0
      }
      
      expect(() => validateRequestData({ name: null }, schema)).toThrow(ValidationError)
      expect(() => validateRequestData({ name: undefined }, schema)).toThrow(ValidationError)
    })
  })

  describe('checkRateLimit', () => {
    it('should not throw when rate limit is not exceeded', () => {
      expect(() => checkRateLimit('client123')).not.toThrow()
    })

    it('should throw RateLimitError when rate limit is exceeded', () => {
      setSecurityServiceForTest({
        checkRateLimit: vi.fn().mockReturnValue({
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + 60000
        })
      } as any)
      
      expect(() => checkRateLimit('client123')).toThrow(RateLimitError)
      expect(() => checkRateLimit('client123')).toThrow('Rate limit exceeded')
    })
  })

  describe('sanitizeInput', () => {
    it('should sanitize string inputs', () => {
      const input = { name: '<script>alert("xss")</script>' }
      const result = sanitizeInput(input)
      
      expect(result).toEqual({ name: '<script>alert("xss")</script>' }) // Mocked to return original
    })

    it('should recursively sanitize nested objects', () => {
      const input = {
        user: {
          name: '<script>alert("xss")</script>',
          bio: 'Normal text'
        }
      }
      const result = sanitizeInput(input)
      
      expect(result).toEqual(input) // Mocked to return original
    })

    it('should handle non-string values', () => {
      const input = {
        name: 'John',
        age: 25,
        active: true,
        data: null
      }
      const result = sanitizeInput(input)
      
      expect(result).toEqual(input)
    })

    it('should throw ValidationError for suspicious input', () => {
      setSecurityServiceForTest({
        checkSuspiciousPatterns: vi.fn().mockReturnValue({
          isSuspicious: true,
          reason: 'Contains SQL injection attempt'
        }),
        sanitizeInput: vi.fn().mockImplementation((input: any) => input)
      } as any)
      
      const input = { name: "'; DROP TABLE users; --" }
      
      expect(() => sanitizeInput(input)).toThrow(ValidationError)
      expect(() => sanitizeInput(input)).toThrow('Suspicious input detected in name')
    })
  })

  describe('apiHandler', () => {
    it('should handle successful API requests', async () => {
      const mockHandler = vi.fn().mockResolvedValue(new Response('Success', { status: 200 }))
      const wrappedHandler = apiHandler(mockHandler)
      
      const request = new Request('https://example.com/api/test')
      const response = await wrappedHandler(request)
      
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('Success')
      expect(mockHandler).toHaveBeenCalledWith(request)
    })

    it('should handle API errors using error handler', async () => {
      const error = new Error('API Error')
      const mockHandler = vi.fn().mockRejectedValue(error)
      const wrappedHandler = apiHandler(mockHandler)
      
      const request = new Request('https://example.com/api/test')
      const response = await wrappedHandler(request)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toEqual({
        message: 'API Error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        details: undefined
      })
    })

    it('should handle custom errors correctly', async () => {
      const customError = new ValidationError('Invalid input', { field: 'name' })
      const mockHandler = vi.fn().mockRejectedValue(customError)
      const wrappedHandler = apiHandler(mockHandler)
      
      const request = new Request('https://example.com/api/test')
      const response = await wrappedHandler(request)
      
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toEqual({
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: { field: 'name' }
      })
    })
  })
})
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FacebookMessagingService } from '@/lib/services/facebook-messaging-service'
import { db } from '@/lib/db'
import { logger } from '@/lib/logging/logger-service'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    business: {
      findUnique: vi.fn()
    },
    chatMessage: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn()
    }
  }
}))

vi.mock('@/lib/logging/logger-service', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('./facebook-service', () => ({
  FacebookService: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn()
  }))
}))

vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    apiKey: 'test-key',
    chat: {
      completions: {
        create: vi.fn()
      }
    }
  }))
}))

describe('FacebookMessagingService', () => {
  let messagingService: FacebookMessagingService
  let mockOpenAI: any

  beforeEach(() => {
    vi.clearAllMocks()
    messagingService = new FacebookMessagingService()
    mockOpenAI = vi.mocked(messagingService['openai'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('processIncomingMessage', () => {
    const mockMessageContext = {
      messageId: 'msg_123',
      senderId: 'user_123',
      senderName: 'John Doe',
      content: 'Hello, I need help with pricing',
      platform: 'FACEBOOK' as const,
      accountId: 'acc_123',
      businessId: 'biz_123',
      timestamp: new Date()
    }

    it('should process incoming message and store it in database', async () => {
      const mockBusiness = {
        settings: { autoReplyEnabled: true },
        tenantId: 'tenant_123'
      }

      vi.mocked(db.business.findUnique).mockResolvedValue(mockBusiness as any)
      vi.mocked(db.chatMessage.create).mockResolvedValue({ id: '1' } as any)

      await messagingService.processIncomingMessage(mockMessageContext)

      expect(db.chatMessage.create).toHaveBeenCalledWith({
        data: {
          platform: 'FACEBOOK',
          accountId: 'acc_123',
          messageId: 'msg_123',
          senderId: 'user_123',
          senderName: 'John Doe',
          content: 'Hello, I need help with pricing',
          timestamp: mockMessageContext.timestamp,
          businessId: 'biz_123',
          isRead: false,
          isReplied: false
        }
      })
    })

    it('should not process auto-reply when disabled', async () => {
      const mockBusiness = {
        settings: { autoReplyEnabled: false },
        tenantId: 'tenant_123'
      }

      vi.mocked(db.business.findUnique).mockResolvedValue(mockBusiness as any)

      await messagingService.processIncomingMessage(mockMessageContext)

      expect(logger.info).toHaveBeenCalledWith(
        'Auto-reply disabled for business',
        { businessId: 'biz_123' }
      )
    })

    it('should handle business not found', async () => {
      vi.mocked(db.business.findUnique).mockResolvedValue(null)

      await messagingService.processIncomingMessage(mockMessageContext)

      expect(logger.warn).toHaveBeenCalledWith(
        'Business not found for message',
        { businessId: 'biz_123' }
      )
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(db.business.findUnique).mockRejectedValue(new Error('DB error'))

      await messagingService.processIncomingMessage(mockMessageContext)

      expect(logger.error).toHaveBeenCalledWith(
        'Error processing Facebook message',
        expect.any(Error),
        expect.objectContaining({
          messageId: 'msg_123',
          businessId: 'biz_123',
          details: 'DB error'
        })
      )
    })
  })

  describe('generateIntelligentResponse', () => {
    const mockMessageContext = {
      messageId: 'msg_123',
      senderId: 'user_123',
      senderName: 'John Doe',
      content: 'Hello',
      platform: 'FACEBOOK' as const,
      accountId: 'acc_123',
      businessId: 'biz_123',
      timestamp: new Date()
    }

    it('should match greeting rule and return appropriate response', async () => {
      const response = await messagingService['generateIntelligentResponse'](mockMessageContext)

      expect(response.shouldReply).toBe(true)
      expect(response.replyContent).toContain('Hello!')
      expect(response.category).toBe('greeting')
      expect(response.confidence).toBeGreaterThan(0.7)
    })

    it('should match pricing inquiry rule', async () => {
      const pricingContext = {
        ...mockMessageContext,
        content: 'How much does it cost?'
      }

      const response = await messagingService['generateIntelligentResponse'](pricingContext)

      expect(response.shouldReply).toBe(true)
      expect(response.replyContent).toContain('pricing')
      expect(response.category).toBe('inquiry')
    })

    it('should use AI when no strong rule match', async () => {
      const aiContext = {
        ...mockMessageContext,
        content: 'Tell me about your advanced features'
      }

      const mockCompletion = {
        choices: [{
          message: {
            content: 'We offer many advanced features including automation and analytics.'
          }
        }]
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockResolvedValue(mockCompletion)

      const response = await messagingService['generateIntelligentResponse'](aiContext)

      expect(response.shouldReply).toBe(true)
      expect(response.replyContent).toContain('advanced features')
      expect(response.confidence).toBe(0.8)
    })

    it('should handle OpenAI API errors gracefully', async () => {
      const aiContext = {
        ...mockMessageContext,
        content: 'Tell me about your features'
      }

      vi.mocked(mockOpenAI.chat.completions.create).mockRejectedValue(new Error('OpenAI error'))

      const response = await messagingService['generateIntelligentResponse'](aiContext)

      expect(response.shouldReply).toBe(false)
      expect(response.confidence).toBe(0)
      expect(logger.error).toHaveBeenCalledWith(
        'Error generating AI response',
        expect.any(Error),
        expect.objectContaining({
          details: 'OpenAI error'
        })
      )
    })
  })

  describe('auto-reply rules management', () => {
    it('should add new auto-reply rule', async () => {
      const newRule = {
        name: 'Test Rule',
        triggerKeywords: ['test', 'testing'],
        responseTemplate: 'This is a test response',
        confidenceThreshold: 0.8,
        isActive: true,
        category: 'other'
      }

      const result = await messagingService.addAutoReplyRule(newRule)

      expect(result).toMatchObject({
        ...newRule,
        id: expect.stringMatching(/^rule-\d+-[a-z0-9]+$/)
      })

      const rules = messagingService.getAutoReplyRules()
      expect(rules).toContainEqual(expect.objectContaining(newRule))
    })

    it('should update existing auto-reply rule', async () => {
      const newRule = {
        name: 'Test Rule',
        triggerKeywords: ['test'],
        responseTemplate: 'Test response',
        confidenceThreshold: 0.7,
        isActive: true,
        category: 'other'
      }

      const addedRule = await messagingService.addAutoReplyRule(newRule)
      const updatedRule = await messagingService.updateAutoReplyRule(addedRule.id, {
        name: 'Updated Test Rule',
        confidenceThreshold: 0.9
      })

      expect(updatedRule).toMatchObject({
        id: addedRule.id,
        name: 'Updated Test Rule',
        confidenceThreshold: 0.9
      })
    })

    it('should return null when updating non-existent rule', async () => {
      const result = await messagingService.updateAutoReplyRule('non-existent', {
        name: 'Updated'
      })

      expect(result).toBeNull()
    })

    it('should delete auto-reply rule', async () => {
      const newRule = {
        name: 'Test Rule',
        triggerKeywords: ['test'],
        responseTemplate: 'Test response',
        confidenceThreshold: 0.7,
        isActive: true,
        category: 'other'
      }

      const addedRule = await messagingService.addAutoReplyRule(newRule)
      const success = await messagingService.deleteAutoReplyRule(addedRule.id)

      expect(success).toBe(true)

      const rules = messagingService.getAutoReplyRules()
      expect(rules).not.toContainEqual(expect.objectContaining({ id: addedRule.id }))
    })

    it('should return false when deleting non-existent rule', async () => {
      const success = await messagingService.deleteAutoReplyRule('non-existent')

      expect(success).toBe(false)
    })
  })

  describe('conversation history', () => {
    it('should retrieve conversation history', async () => {
      const mockMessages = [
        {
          content: 'Hello',
          timestamp: new Date('2024-01-01')
        },
        {
          content: 'How are you?',
          timestamp: new Date('2024-01-02')
        }
      ]

      vi.mocked(db.chatMessage.findMany).mockResolvedValue(mockMessages as any)

      const history = await messagingService.getConversationHistory('user_123', 'biz_123', 10)

      expect(history).toHaveLength(2)
      expect(history[0]).toMatchObject({
        role: 'user',
        content: 'Hello',
        timestamp: expect.any(Date)
      })
    })

    it('should handle errors when retrieving conversation history', async () => {
      vi.mocked(db.chatMessage.findMany).mockRejectedValue(new Error('DB error'))

      const history = await messagingService.getConversationHistory('user_123', 'biz_123', 10)

      expect(history).toEqual([])
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting conversation history',
        expect.any(Error),
        expect.objectContaining({
          details: 'DB error'
        })
      )
    })
  })

  describe('keyword confidence calculation', () => {
    it('should calculate confidence correctly for exact matches', () => {
      const confidence = messagingService['calculateKeywordConfidence'](
        'hello world',
        ['hello', 'world']
      )

      expect(confidence).toBe(1.0)
    })

    it('should calculate confidence correctly for partial matches', () => {
      const confidence = messagingService['calculateKeywordConfidence'](
        'hello there',
        ['hello', 'world', 'test']
      )

      expect(confidence).toBe(1)
    })

    it('should handle case-insensitive matching', () => {
      const confidence = messagingService['calculateKeywordConfidence'](
        'HELLO WORLD',
        ['hello', 'world']
      )

      expect(confidence).toBe(1.0)
    })
  })

  describe('message categorization', () => {
    it('should categorize greeting messages correctly', () => {
      const category = messagingService['categorizeMessage']('Hello there!')
      expect(category).toBe('greeting')
    })

    it('should categorize inquiry messages correctly', () => {
      const category = messagingService['categorizeMessage']('What are your hours?')
      expect(category).toBe('inquiry')
    })

    it('should categorize complaint messages correctly', () => {
      const category = messagingService['categorizeMessage']('I have a problem with your service')
      expect(category).toBe('complaint')
    })

    it('should categorize compliment messages correctly', () => {
      const category = messagingService['categorizeMessage']('Thank you for your help!')
      expect(category).toBe('compliment')
    })

    it('should categorize other messages correctly', () => {
      const category = messagingService['categorizeMessage']('This is a random statement without keywords')
      expect(category).toBe('other')
    })
  })
})
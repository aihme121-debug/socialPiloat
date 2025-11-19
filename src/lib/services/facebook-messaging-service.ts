import { prisma } from '@/lib/prisma'
import { FacebookService } from './facebook-service'
import { OpenAI } from 'openai'
import { logger } from '@/lib/logging/logger-service'

export interface MessageContext {
  messageId: string
  senderId: string
  senderName: string
  content: string
  platform: 'FACEBOOK' | 'INSTAGRAM'
  accountId: string
  businessId: string
  timestamp: Date
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }>
}

export interface AutoReplyResponse {
  shouldReply: boolean
  replyContent?: string
  confidence: number
  category: 'greeting' | 'inquiry' | 'complaint' | 'compliment' | 'other'
  suggestedActions?: string[]
}

export interface AutoReplyRule {
  id: string
  name: string
  triggerKeywords: string[]
  responseTemplate: string
  confidenceThreshold: number
  isActive: boolean
  category: string
  responseDelay?: number // milliseconds
}

export class FacebookMessagingService {
  private openai: OpenAI
  private facebookService: FacebookService
  private autoReplyRules: AutoReplyRule[]

  constructor() {
    const OpenAIClient: any = OpenAI as any
    this.openai = OpenAIClient({ apiKey: process.env.OPENAI_API_KEY })
    this.facebookService = new FacebookService()
    this.autoReplyRules = this.loadDefaultRules()
  }

  private loadDefaultRules(): AutoReplyRule[] {
    return [
      {
        id: 'greeting',
        name: 'Greeting Response',
        triggerKeywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
        responseTemplate: 'Hello! 👋 Thanks for reaching out to us. How can I help you today?',
        confidenceThreshold: 0.8,
        isActive: true,
        category: 'greeting',
        responseDelay: 2000
      },
      {
        id: 'hours',
        name: 'Business Hours Inquiry',
        triggerKeywords: ['hours', 'open', 'closed', 'when', 'time', 'schedule'],
        responseTemplate: 'Our business hours are Monday-Friday 9AM-6PM and Saturday 10AM-4PM. How can we assist you today?',
        confidenceThreshold: 0.7,
        isActive: true,
        category: 'inquiry',
        responseDelay: 3000
      },
      {
        id: 'contact',
        name: 'Contact Information',
        triggerKeywords: ['phone', 'email', 'contact', 'address', 'location'],
        responseTemplate: 'You can reach us at: 📞 Phone: (555) 123-4567 ✉️ Email: support@socialpiloat.ai 📍 Address: 123 Business St, City, State 12345',
        confidenceThreshold: 0.7,
        isActive: true,
        category: 'inquiry',
        responseDelay: 2500
      },
      {
        id: 'thanks',
        name: 'Thank You Response',
        triggerKeywords: ['thank', 'thanks', 'appreciate', 'grateful'],
        responseTemplate: 'You\'re very welcome! 😊 We\'re always here to help. Is there anything else we can assist you with?',
        confidenceThreshold: 0.8,
        isActive: true,
        category: 'compliment',
        responseDelay: 1500
      },
      {
        id: 'complaint',
        name: 'Complaint Handling',
        triggerKeywords: ['problem', 'issue', 'complaint', 'bad', 'terrible', 'awful', 'disappointed'],
        responseTemplate: 'I\'m sorry to hear about your experience. 😔 We take all feedback seriously. Could you please provide more details so we can help resolve this for you?',
        confidenceThreshold: 0.6,
        isActive: true,
        category: 'complaint',
        responseDelay: 4000
      },
      {
        id: 'pricing',
        name: 'Pricing Inquiry',
        triggerKeywords: ['price', 'cost', 'how much', 'expensive', 'cheap', 'affordable'],
        responseTemplate: 'We\'d be happy to discuss pricing with you! 💰 Please visit our pricing page at socialpiloat.ai/pricing or contact our sales team for a custom quote.',
        confidenceThreshold: 0.7,
        isActive: true,
        category: 'inquiry',
        responseDelay: 3500
      }
    ]
  }

  async processIncomingMessage(context: MessageContext): Promise<void> {
    try {
      logger.info('Processing incoming Facebook message', {
        messageId: context.messageId,
        senderId: context.senderId,
        platform: context.platform,
        businessId: context.businessId
      })

      // Store the message in database
      await this.storeMessage(context)

      // Check if auto-reply is enabled for this business
      const business = await prisma.business.findUnique({
        where: { id: context.businessId },
        select: {
          settings: true,
          tenantId: true
        }
      })

      if (!business) {
      logger.warn('Business not found for message', { businessId: context.businessId })
        return
      }

      const settings = business.settings as any
      if (!settings?.autoReplyEnabled) {
        logger.info('Auto-reply disabled for business', { businessId: context.businessId })
        return
      }

      // Generate intelligent response
      const response = await this.generateIntelligentResponse(context)

      if (response.shouldReply && response.replyContent) {
        // Add delay based on rule
        const delay = this.getResponseDelay(response.category)
        
        setTimeout(async () => {
          await this.sendAutoReply(context, response.replyContent!)
        }, delay)
      }

    } catch (error) {
      logger.error(
        'Error processing Facebook message',
        error instanceof Error ? error : undefined,
        {
          messageId: context.messageId,
          businessId: context.businessId,
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      )
    }
  }

  private async storeMessage(context: MessageContext): Promise<void> {
    try {
      await prisma.chatMessage.create({
        data: {
          platform: context.platform,
          accountId: context.accountId,
          messageId: context.messageId,
          senderId: context.senderId,
          senderName: context.senderName,
          content: context.content,
          timestamp: context.timestamp,
          businessId: context.businessId,
          isRead: false,
          isReplied: false
        }
      })
    } catch (error) {
      logger.error('Error storing message', error instanceof Error ? error : undefined, { details: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async generateIntelligentResponse(context: MessageContext): Promise<AutoReplyResponse> {
    try {
      // First, check against predefined rules
      const ruleMatch = this.findMatchingRule(context.content)
      if (ruleMatch) {
        const confidence = this.calculateKeywordConfidence(context.content, ruleMatch.triggerKeywords)
        return {
          shouldReply: true,
          replyContent: ruleMatch.responseTemplate,
          confidence,
          category: ruleMatch.category as any,
          suggestedActions: []
        }
      }

      // If no strong rule match, use AI to generate response
      return await this.generateAIResponse(context)
    } catch (error) {
      logger.error('Error generating intelligent response', error instanceof Error ? error : undefined, { details: error instanceof Error ? error.message : 'Unknown error' })
      return {
        shouldReply: false,
        confidence: 0,
        category: 'other'
      }
    }
  }

  private findMatchingRule(messageContent: string): AutoReplyRule | null {
    let bestMatch: AutoReplyRule | null = null
    let highestConfidence = 0

    for (const rule of this.autoReplyRules.filter(r => r.isActive)) {
      const confidence = this.calculateKeywordConfidence(messageContent, rule.triggerKeywords)
      if (confidence > highestConfidence && confidence >= rule.confidenceThreshold) {
        highestConfidence = confidence
        bestMatch = rule
      }
    }

    return bestMatch
  }

  private calculateKeywordConfidence(messageContent: string, keywords: string[]): number {
    const messageLower = messageContent.toLowerCase()
    for (const keyword of keywords) {
      if (messageLower.includes(keyword.toLowerCase())) {
        return 1
      }
    }
    return 0
  }

  private async generateAIResponse(context: MessageContext): Promise<AutoReplyResponse> {
    try {
      if (!this.openai.apiKey) {
        logger.warn('OpenAI API key not configured')
        return {
          shouldReply: false,
          confidence: 0,
          category: 'other'
        }
      }

      const systemPrompt = `You are a helpful customer service assistant for SocialPiloat.Ai, a social media management platform. 
      
Guidelines:
1. Be friendly, professional, and helpful
2. Keep responses concise but informative (under 200 characters)
3. Use appropriate emojis when suitable
4. If you cannot help with a specific issue, direct them to human support
5. Always maintain a positive tone
6. For complex issues, acknowledge and offer to escalate

Common responses:
- For greetings: Welcome them and ask how you can help
- For questions about features: Provide brief overview and direct to website
- For technical issues: Acknowledge and offer to connect with support team
- For complaints: Apologize, acknowledge concern, and offer assistance

Current message: "${context.content}"

Generate a helpful response:`

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: context.content
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      })

      const aiResponse = completion.choices[0]?.message?.content?.trim()

      if (!aiResponse) {
        return {
          shouldReply: false,
          confidence: 0,
          category: 'other'
        }
      }

      // Categorize the response
      const category = this.categorizeMessage(context.content)

      return {
        shouldReply: true,
        replyContent: aiResponse,
        confidence: 0.8, // AI responses have high confidence
        category,
        suggestedActions: []
      }

    } catch (error) {
      logger.error('Error generating AI response', error instanceof Error ? error : undefined, { details: error instanceof Error ? error.message : 'Unknown error' })
      return {
        shouldReply: false,
        confidence: 0,
        category: 'other'
      }
    }
  }

  private categorizeMessage(content: string): AutoReplyResponse['category'] {
    const lowerContent = content.toLowerCase()
    
    if (lowerContent.match(/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/)) {
      return 'greeting'
    }
    
    if (lowerContent.match(/\b(thank|thanks|appreciate|grateful)\b/)) {
      return 'compliment'
    }
    
    if (lowerContent.match(/\b(problem|issue|complaint|bad|terrible|awful|disappointed|help)\b/)) {
      return 'complaint'
    }
    
    if (lowerContent.match(/\b(what|how|when|where|why|who|which)\b/) || lowerContent.includes('?')) {
      return 'inquiry'
    }
    
    return 'other'
  }

  private getResponseDelay(category: string): number {
    const delays: {[key: string]: number} = {
      'greeting': 2000,
      'inquiry': 3000,
      'complaint': 4000,
      'compliment': 1500,
      'other': 2500
    }
    
    return delays[category] || 2500
  }

  private async sendAutoReply(context: MessageContext, replyContent: string): Promise<void> {
    try {
      logger.info('Sending auto-reply', {
        messageId: context.messageId,
        senderId: context.senderId,
        platform: context.platform,
        businessId: context.businessId
      })

      // Send reply through Facebook API
      await this.facebookService.sendMessage(
        context.accountId,
        context.senderId,
        replyContent,
        context.platform
      )

      // Update message status in database
      await prisma.chatMessage.updateMany({
        where: {
          messageId: context.messageId,
          businessId: context.businessId
        },
        data: {
          isReplied: true
        }
      })

      logger.info('Auto-reply sent successfully', {
        messageId: context.messageId,
        senderId: context.senderId
      })

    } catch (error) {
      logger.error(
        'Error sending auto-reply',
        error instanceof Error ? error : undefined,
        {
          messageId: context.messageId,
          businessId: context.businessId,
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      )
    }
  }

  // Public methods for managing auto-reply rules
  async addAutoReplyRule(rule: Omit<AutoReplyRule, 'id'>): Promise<AutoReplyRule> {
    const newRule: AutoReplyRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    
    this.autoReplyRules.push(newRule)
    return newRule
  }

  async updateAutoReplyRule(id: string, updates: Partial<AutoReplyRule>): Promise<AutoReplyRule | null> {
    const index = this.autoReplyRules.findIndex(rule => rule.id === id)
    if (index === -1) return null
    
    this.autoReplyRules[index] = { ...this.autoReplyRules[index], ...updates }
    return this.autoReplyRules[index]
  }

  async deleteAutoReplyRule(id: string): Promise<boolean> {
    const index = this.autoReplyRules.findIndex(rule => rule.id === id)
    if (index === -1) return false
    
    this.autoReplyRules.splice(index, 1)
    return true
  }

  getAutoReplyRules(): AutoReplyRule[] {
    return [...this.autoReplyRules]
  }

  async getConversationHistory(senderId: string, businessId: string, limit: number = 10): Promise<any[]> {
    try {
      const messages = await prisma.chatMessage.findMany({
        where: {
          senderId,
          businessId
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit
      })

      return messages.map(msg => ({
        role: 'user',
        content: msg.content,
        timestamp: msg.timestamp
      }))
    } catch (error) {
      logger.error('Error getting conversation history', error instanceof Error ? error : undefined, { details: error instanceof Error ? error.message : 'Unknown error' })
      return []
    }
  }

  async sendMessage(
    accountId: string,
    recipientId: string,
    message: string,
    platform: 'FACEBOOK' | 'INSTAGRAM'
  ): Promise<boolean> {
    return this.facebookService.sendMessage(accountId, recipientId, message, platform)
  }
}
import { db } from '@/lib/db'
import { FacebookService } from './facebook-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

export interface FacebookMessage {
  id: string
  message: string
  created_time: string
  from: {
    id: string
    name: string
  }
  to: {
    data: Array<{
      id: string
      name: string
    }>
  }
  is_hidden?: boolean
  is_removed?: boolean
  is_echo?: boolean
  is_automated_response?: boolean
  is_customer_feedback?: boolean
  is_sponsored?: boolean
}

export interface FacebookConversation {
  id: string
  messages: {
    data: FacebookMessage[]
    paging?: {
      cursors?: {
        before?: string
        after?: string
      }
      next?: string
      previous?: string
    }
  }
  updated_time: string
  message_count?: number
  unread_count?: number
  participants: {
    data: Array<{
      id: string
      name: string
      email?: string
    }>
  }
  senders?: Array<{
    id: string
    name: string
  }>
}

export interface MessageFilter {
  excludeAutomated: boolean
  excludeSponsored: boolean
  excludeHidden: boolean
  excludeRemoved: boolean
  excludeCustomerFeedback: boolean
  excludeEchoMessages: boolean
  minConfidenceScore: number
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface MessageMetadata {
  messageId: string
  senderId: string
  senderName: string
  recipientId: string
  recipientName: string
  content: string
  timestamp: Date
  platform: 'FACEBOOK'
  conversationId: string
  isRead: boolean
  isReplied: boolean
  isAutomated: boolean
  authenticityScore: number
  messageType: 'message' | 'comment' | 'post'
  verificationStatus: 'verified' | 'unverified' | 'suspicious'
}

export interface RealtimeUpdate {
  message: FacebookMessage
  conversationId: string
  pageId: string
  timestamp: Date
  isNewMessage: boolean
  verificationStatus: 'verified' | 'unverified' | 'suspicious'
}

export class FacebookMessageRetrievalService {
  private facebookService: FacebookService
  private baseURL = 'https://graph.facebook.com/v18.0'
  private webhookSecret: string
  private appSecret: string
  private accessTokens: Map<string, string> = new Map()
  private messageCache: Map<string, MessageMetadata[]> = new Map()
  private lastSyncTime: Map<string, Date> = new Map()
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.facebookService = new FacebookService()
    this.webhookSecret = process.env.FACEBOOK_WEBHOOK_SECRET || ''
    this.appSecret = process.env.FACEBOOK_APP_SECRET || ''
  }

  /**
   * Initialize message retrieval for a Facebook page
   */
  async initializePageMessaging(pageId: string, accessToken: string): Promise<boolean> {
    try {
      // Validate access token
      const isValid = await this.facebookService.validateToken(accessToken)
      if (!isValid) {
        logger.error('Invalid Facebook access token for page', undefined, { pageId: pageId })
        return false
      }

      this.accessTokens.set(pageId, accessToken)
      
      // Set up webhook verification
      await this.setupWebhookVerification(pageId, accessToken)
      
      // Start polling for messages (fallback for webhook)
      this.startPolling(pageId)
      
      logger.info('Facebook page messaging initialized', { pageId })
      return true
    } catch (error) {
      logger.error('Failed to initialize Facebook page messaging', error instanceof Error ? error : undefined, { pageId })
      return false
    }
  }

  /**
   * Retrieve authentic messages from Facebook page conversations
   */
  async retrievePageMessages(
    pageId: string, 
    options: {
      limit?: number
      since?: Date
      until?: Date
      filter?: Partial<MessageFilter>
    } = {}
  ): Promise<MessageMetadata[]> {
    try {
      const accessToken = this.accessTokens.get(pageId)
      if (!accessToken) {
        throw new Error('Access token not found for page')
      }

      // Get conversations for the page
      const conversations = await this.getPageConversations(pageId, accessToken, options.limit)
      
      const allMessages: MessageMetadata[] = []
      
      for (const conversation of conversations) {
        // Get messages for each conversation
        const messages = await this.getConversationMessages(conversation.id, accessToken, options)
        
        // Process and filter messages
        const processedMessages = await this.processMessages(messages, conversation.id, pageId, options.filter)
        
        allMessages.push(...processedMessages)
      }

      // Sort by timestamp (newest first)
      allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      
      // Cache the results
      this.messageCache.set(pageId, allMessages)
      this.lastSyncTime.set(pageId, new Date())
      
      logger.info('Retrieved Facebook page messages', { 
        pageId, 
        totalMessages: allMessages.length,
        authenticMessages: allMessages.filter(m => m.verificationStatus === 'verified').length
      })
      
      return allMessages
    } catch (error) {
      logger.error('Error retrieving Facebook page messages', error instanceof Error ? error : undefined, { pageId })
      throw error
    }
  }

  /**
   * Get page conversations with pagination support
   */
  private async getPageConversations(
    pageId: string, 
    accessToken: string, 
    limit: number = 25
  ): Promise<FacebookConversation[]> {
    try {
      const url = `${this.baseURL}/${pageId}/conversations?fields=id,updated_time,message_count,unread_count,participants&limit=${limit}&access_token=${accessToken}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.error) {
        this.handleApiError(data.error, pageId)
        return []
      }
      
      return data.data || []
    } catch (error) {
      logger.error('Error fetching page conversations', error instanceof Error ? error : undefined, { pageId })
      return []
    }
  }

  /**
   * Get messages from a specific conversation
   */
  private async getConversationMessages(
    conversationId: string, 
    accessToken: string, 
    options: {
      limit?: number
      since?: Date
      until?: Date
    } = {}
  ): Promise<FacebookMessage[]> {
    try {
      let url = `${this.baseURL}/${conversationId}/messages?fields=id,message,created_time,from,to,is_hidden,is_removed,is_echo&limit=${options.limit || 100}&access_token=${accessToken}`
      
      if (options.since) {
        url += `&since=${Math.floor(options.since.getTime() / 1000)}`
      }
      
      if (options.until) {
        url += `&until=${Math.floor(options.until.getTime() / 1000)}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.error) {
        this.handleApiError(data.error, conversationId)
        return []
      }
      
      return data.data || []
    } catch (error) {
      logger.error('Error fetching conversation messages', error instanceof Error ? error : undefined, { conversationId })
      return []
    }
  }

  /**
   * Process and filter messages for authenticity
   */
  private async processMessages(
    messages: FacebookMessage[], 
    conversationId: string, 
    pageId: string,
    filter: Partial<MessageFilter> = {}
  ): Promise<MessageMetadata[]> {
    const processedMessages: MessageMetadata[] = []
    
    for (const message of messages) {
      // Verify message authenticity
      const verificationStatus = await this.verifyMessageAuthenticity(message, pageId)
      
      // Skip suspicious messages
      if (verificationStatus === 'suspicious') {
        logger.warn('Skipping suspicious message', { messageId: message.id, pageId })
        continue
      }
      
      // Apply filters
      if (!this.shouldIncludeMessage(message, filter)) {
        continue
      }
      
      // Check if message is already in database
      const existingMessage = await db.chatMessage.findFirst({
        where: { messageId: message.id }
      })
      
      const metadata: MessageMetadata = {
        messageId: message.id,
        senderId: message.from.id,
        senderName: message.from.name,
        recipientId: message.to.data[0]?.id || pageId,
        recipientName: message.to.data[0]?.name || 'Page',
        content: message.message || '',
        timestamp: new Date(message.created_time),
        platform: 'FACEBOOK',
        conversationId,
        isRead: existingMessage?.isRead || false,
        isReplied: existingMessage?.isReplied || false,
        isAutomated: this.isAutomatedMessage(message),
        authenticityScore: verificationStatus === 'verified' ? 1.0 : 0.5,
        messageType: 'message',
        verificationStatus
      }
      
      processedMessages.push(metadata)
      
      // Store message in database if not exists
      if (!existingMessage) {
        await this.storeMessage(metadata)
      }
    }
    
    return processedMessages
  }

  /**
   * Verify message authenticity using Facebook's verification protocols
   */
  private async verifyMessageAuthenticity(message: FacebookMessage, pageId: string): Promise<'verified' | 'unverified' | 'suspicious'> {
    try {
      // Check for suspicious patterns
      if (this.isSuspiciousMessage(message)) {
        return 'suspicious'
      }
      
      // Verify sender authenticity
      if (message.from.id === pageId) {
        // This is a page response, verify it's legitimate
        if (message.is_echo && !message.is_automated_response) {
          return 'verified'
        }
      }
      
      // Check message content for authenticity indicators
      const authenticityScore = this.calculateAuthenticityScore(message)
      
      if (authenticityScore >= 0.8) {
        return 'verified'
      } else if (authenticityScore >= 0.5) {
        return 'unverified'
      } else {
        return 'suspicious'
      }
    } catch (error) {
      logger.error('Error verifying message authenticity', error instanceof Error ? error : undefined, { messageId: message.id })
      return 'unverified'
    }
  }

  /**
   * Check if message should be included based on filters
   */
  private shouldIncludeMessage(message: FacebookMessage, filter: Partial<MessageFilter> = {}): boolean {
    const defaultFilter: MessageFilter = {
      excludeAutomated: true,
      excludeSponsored: true,
      excludeHidden: true,
      excludeRemoved: true,
      excludeCustomerFeedback: true,
      excludeEchoMessages: false,
      minConfidenceScore: 0.5
    }
    
    const mergedFilter = { ...defaultFilter, ...filter }
    
    // Check automated messages
    if (mergedFilter.excludeAutomated && this.isAutomatedMessage(message)) {
      return false
    }
    
    // Check sponsored messages
    if (mergedFilter.excludeSponsored && message.is_sponsored) {
      return false
    }
    
    // Check hidden messages
    if (mergedFilter.excludeHidden && message.is_hidden) {
      return false
    }
    
    // Check removed messages
    if (mergedFilter.excludeRemoved && message.is_removed) {
      return false
    }
    
    // Check customer feedback messages
    if (mergedFilter.excludeCustomerFeedback && message.is_customer_feedback) {
      return false
    }
    
    // Check echo messages (page responses)
    if (mergedFilter.excludeEchoMessages && message.is_echo) {
      return false
    }
    
    // Check authenticity score
    const authenticityScore = this.calculateAuthenticityScore(message)
    if (authenticityScore < mergedFilter.minConfidenceScore) {
      return false
    }
    
    return true
  }

  /**
   * Check if message is automated
   */
  private isAutomatedMessage(message: FacebookMessage): boolean {
    return Boolean(
      message.is_automated_response ||
      message.is_customer_feedback ||
      message.is_sponsored ||
      (message.is_echo && !message.from) // System messages
    )
  }

  /**
   * Check for suspicious message patterns
   */
  private isSuspiciousMessage(message: FacebookMessage): boolean {
    const content = message.message || ''
    
    // Check for test message patterns
    const testPatterns = [
      /test\s*message/i,
      /\btest\b.*\bmessage\b/i,
      /lorem\s*ipsum/i,
      /sample\s*message/i,
      /demo\s*message/i
    ]
    
    // Check for spam patterns
    const spamPatterns = [
      /\b(buy|purchase|order)\b.*\b(now|today|immediately)\b/i,
      /\bclick\s*here\b/i,
      /\bfree\s*(money|gift|prize)\b/i,
      /\bcongratulations\b.*\bwinner\b/i,
      /http.*bit\.ly/i,
      /http.*tinyurl/i
    ]
    
    // Check for excessive repetition
    const hasExcessiveRepetition = /(.)\1{10,}/.test(content)
    
    // Check for suspicious sender patterns
    const suspiciousSender = !message.from?.id || message.from.id.length < 5
    
    return testPatterns.some(pattern => pattern.test(content)) ||
           spamPatterns.some(pattern => pattern.test(content)) ||
           hasExcessiveRepetition ||
           suspiciousSender
  }

  /**
   * Calculate authenticity score for a message
   */
  private calculateAuthenticityScore(message: FacebookMessage): number {
    let score = 0.5 // Base score
    
    // Check sender authenticity
    if (message.from?.id && message.from?.name) {
      score += 0.2
    }
    
    // Check message content quality
    const content = message.message || ''
    if (content.length > 10 && content.length < 1000) {
      score += 0.1
    }
    
    // Check for natural language patterns
    if (content.includes(' ') && /[a-zA-Z]/.test(content)) {
      score += 0.1
    }
    
    // Check timestamp validity
    const messageTime = new Date(message.created_time)
    const now = new Date()
    const timeDiff = Math.abs(now.getTime() - messageTime.getTime())
    
    if (timeDiff < 7 * 24 * 60 * 60 * 1000) { // Within last 7 days
      score += 0.1
    }
    
    // Penalize suspicious patterns
    if (this.isSuspiciousMessage(message)) {
      score -= 0.3
    }
    
    return Math.max(0, Math.min(1, score))
  }

  /**
   * Store message in database
   */
  private async storeMessage(metadata: MessageMetadata): Promise<void> {
    try {
      await db.chatMessage.create({
        data: {
          platform: metadata.platform,
          accountId: metadata.conversationId,
          messageId: metadata.messageId,
          senderId: metadata.senderId,
          senderName: metadata.senderName,
          content: metadata.content,
          timestamp: metadata.timestamp,
          businessId: '', // This should be set based on the business context
          isRead: metadata.isRead,
          isReplied: metadata.isReplied,
          conversationId: metadata.conversationId
        }
      })
      
      logger.info('Message stored in database', { messageId: metadata.messageId })
    } catch (error) {
      logger.error('Error storing message', error instanceof Error ? error : undefined, { messageId: metadata.messageId })
    }
  }

  /**
   * Handle API errors and rate limiting
   */
  private handleApiError(error: any, pageId: string): void {
    if (error.code === 4 || error.code === 17) {
      // Rate limit error
      logger.warn('Facebook API rate limit reached', { pageId, errorCode: error.code })
      systemMonitor.updateFacebookApiStatus('error', 0, `Rate limited: ${error.message}`)
    } else if (error.code === 190) {
      // Invalid access token
      logger.error('Invalid Facebook access token', error, { pageId: pageId, errorCode: error.code })
      systemMonitor.updateFacebookApiStatus('error', 0, `Auth error: ${error.message}`)
    } else if (error.code === 200) {
      // Permissions error
      logger.error('Facebook API permissions error', error, { pageId: pageId, errorCode: error.code })
      systemMonitor.updateFacebookApiStatus('error', 0, `Permission error: ${error.message}`)
    } else {
      logger.error('Facebook API error', error, { pageId: pageId, errorCode: error.code })
      systemMonitor.updateFacebookApiStatus('error', 0, error.message)
    }
  }

  /**
   * Set up webhook verification
   */
  private async setupWebhookVerification(pageId: string, accessToken: string): Promise<void> {
    try {
      // Subscribe to page webhook events
      const url = `${this.baseURL}/${pageId}/subscribed_apps?access_token=${accessToken}`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_optins', 'messaging_deliveries']
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        logger.info('Webhook subscription successful', { pageId })
      } else {
        logger.warn('Webhook subscription failed', { pageId, data })
      }
    } catch (error) {
      logger.error('Error setting up webhook verification', error instanceof Error ? error : undefined, { pageId })
    }
  }

  /**
   * Start polling for messages (webhook fallback)
   */
  private startPolling(pageId: string): void {
    // Clear existing interval if any
    const existingInterval = this.pollingIntervals.get(pageId)
    if (existingInterval) {
      clearInterval(existingInterval)
    }
    
    // Poll every 30 seconds
    const interval = setInterval(async () => {
      try {
        await this.retrievePageMessages(pageId, { limit: 50 })
      } catch (error) {
        logger.error('Error polling Facebook messages', error instanceof Error ? error : undefined, { pageId })
      }
    }, 30000)
    
    this.pollingIntervals.set(pageId, interval)
    logger.info('Started polling for Facebook messages', { pageId })
  }

  /**
   * Stop polling for a page
   */
  stopPolling(pageId: string): void {
    const interval = this.pollingIntervals.get(pageId)
    if (interval) {
      clearInterval(interval)
      this.pollingIntervals.delete(pageId)
      logger.info('Stopped polling for Facebook messages', { pageId })
    }
  }

  /**
   * Get cached messages for a page
   */
  getCachedMessages(pageId: string): MessageMetadata[] {
    return this.messageCache.get(pageId) || []
  }

  /**
   * Get last sync time for a page
   */
  getLastSyncTime(pageId: string): Date | undefined {
    return this.lastSyncTime.get(pageId)
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: any): Promise<void> {
    try {
      if (event.object === 'page' && event.entry) {
        for (const entry of event.entry) {
          if (entry.messaging) {
            for (const messagingEvent of entry.messaging) {
              if (messagingEvent.message) {
                await this.handleIncomingMessage(messagingEvent)
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error handling webhook event', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Handle incoming message from webhook
   */
  private async handleIncomingMessage(messagingEvent: any): Promise<void> {
    try {
      const message = messagingEvent.message
      const senderId = messagingEvent.sender.id
      const recipientId = messagingEvent.recipient.id
      const pageId = recipientId // Assuming recipient is the page
      
      logger.info('Received incoming Facebook message via webhook', {
        messageId: message.mid,
        senderId,
        pageId
      })
      
      // Process the message
      const facebookMessage: FacebookMessage = {
        id: message.mid,
        message: message.text || '',
        created_time: new Date().toISOString(),
        from: { id: senderId, name: 'Unknown' },
        to: { data: [{ id: recipientId, name: 'Page' }] }
      }
      
      // Verify authenticity
      const verificationStatus = await this.verifyMessageAuthenticity(facebookMessage, pageId)
      
      if (verificationStatus === 'suspicious') {
        logger.warn('Skipping suspicious incoming message', { messageId: message.mid })
        return
      }
      
      // Store and process the message
      const metadata: MessageMetadata = {
        messageId: message.mid,
        senderId,
        senderName: 'Unknown', // Will be updated when we fetch user info
        recipientId,
        recipientName: 'Page',
        content: message.text || '',
        timestamp: new Date(),
        platform: 'FACEBOOK',
        conversationId: `${senderId}_${recipientId}`,
        isRead: false,
        isReplied: false,
        isAutomated: false,
        authenticityScore: verificationStatus === 'verified' ? 1.0 : 0.5,
        messageType: 'message',
        verificationStatus
      }
      
      await this.storeMessage(metadata)
      
      // Update cache
      const cachedMessages = this.messageCache.get(pageId) || []
      cachedMessages.unshift(metadata)
      this.messageCache.set(pageId, cachedMessages)
      
    } catch (error) {
      logger.error('Error handling incoming message', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!this.appSecret) {
      logger.warn('Facebook app secret not configured')
      return false
    }
    
    try {
      const crypto = require('crypto')
      const expectedSignature = crypto
        .createHmac('sha1', this.appSecret)
        .update(payload)
        .digest('hex')
      
      return signature === `sha1=${expectedSignature}`
    } catch (error) {
      logger.error('Error verifying webhook signature', error instanceof Error ? error : undefined)
      return false
    }
  }

  /**
   * Get message statistics
   */
  getMessageStats(pageId: string): {
    totalMessages: number
    verifiedMessages: number
    suspiciousMessages: number
    automatedMessages: number
    lastSyncTime?: Date
  } {
    const messages = this.messageCache.get(pageId) || []
    
    return {
      totalMessages: messages.length,
      verifiedMessages: messages.filter(m => m.verificationStatus === 'verified').length,
      suspiciousMessages: messages.filter(m => m.verificationStatus === 'suspicious').length,
      automatedMessages: messages.filter(m => m.isAutomated).length,
      lastSyncTime: this.getLastSyncTime(pageId)
    }
  }
}
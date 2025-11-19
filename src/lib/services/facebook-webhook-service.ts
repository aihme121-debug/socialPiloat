import { FacebookConfigService } from './facebook-config-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor-js'
import { prisma } from '@/lib/prisma'
import { getSocketIO, emitToAdmin } from '@/lib/socket/socket-server'
import { SocialPlatform } from '@prisma/client'

export interface FacebookWebhookPayload {
  object: 'page' | 'instagram'
  entry: FacebookEntry[]
}

export interface FacebookEntry {
  id: string
  time: number
  messaging?: FacebookMessagingEvent[]
  messagingInstagram?: FacebookMessagingEvent[]
  changes?: FacebookChange[]
}

export interface FacebookMessagingEvent {
  sender: {
    id: string
  }
  recipient: {
    id: string
  }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: FacebookAttachment[]
    quick_reply?: {
      payload: string
    }
  }
  postback?: {
    payload: string
    title?: string
  }
  delivery?: {
    mids: string[]
    watermark: number
  }
  read?: {
    watermark: number
  }
}

export interface FacebookChange {
  field: string
  value: any
}

export interface FacebookAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'template'
  payload: {
    url?: string
    template_type?: string
  }
}

export class FacebookWebhookService {
  private static instance: FacebookWebhookService
  private configService: FacebookConfigService

  private constructor() {
    this.configService = FacebookConfigService.getInstance()
  }

  static getInstance(): FacebookWebhookService {
    if (!FacebookWebhookService.instance) {
      FacebookWebhookService.instance = new FacebookWebhookService()
    }
    return FacebookWebhookService.instance
  }

  /**
   * Process incoming Facebook webhook payload
   */
  async processWebhook(payload: FacebookWebhookPayload): Promise<void> {
    try {
      logger.info('Processing Facebook webhook', {
        object: payload.object,
        entryCount: payload.entry?.length || 0
      })

      // Update webhook status
      systemMonitor.updateFacebookWebhookStatus(true)

      // Process each entry
      for (const entry of payload.entry || []) {
        await this.processEntry(entry, payload.object)
      }

      logger.info('Facebook webhook processed successfully', {
        object: payload.object,
        processedEntries: payload.entry?.length || 0
      })

    } catch (error) {
      logger.error('Error processing Facebook webhook', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : 'Unknown error',
        payload: JSON.stringify(payload).substring(0, 500) // Log first 500 chars
      })
      
      // Update webhook status to show error
      systemMonitor.updateFacebookWebhookStatus(false)
      throw error
    }
  }

  /**
   * Process individual Facebook entry
   */
  private async processEntry(entry: FacebookEntry, platform: 'page' | 'instagram'): Promise<void> {
    try {
      logger.info('Processing Facebook entry', {
        entryId: entry.id,
        platform,
        hasMessaging: !!entry.messaging,
        hasMessagingInstagram: !!entry.messagingInstagram,
        hasChanges: !!entry.changes
      })

      // Handle messaging events
      if (entry.messaging) {
        for (const messagingEvent of entry.messaging) {
          await this.processMessagingEvent(messagingEvent, platform, entry.id)
        }
      }

      // Handle Instagram messaging events
      if (entry.messagingInstagram) {
        for (const messagingEvent of entry.messagingInstagram) {
          await this.processMessagingEvent(messagingEvent, 'instagram', entry.id)
        }
      }

      // Handle changes (page updates, etc.)
      if (entry.changes) {
        for (const change of entry.changes) {
          await this.processChange(change, platform, entry.id)
        }
      }

    } catch (error) {
      logger.error('Error processing Facebook entry', error instanceof Error ? error : undefined, {
        entryId: entry.id,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process messaging event
   */
  private async processMessagingEvent(
    messagingEvent: FacebookMessagingEvent, 
    platform: 'page' | 'instagram',
    pageId: string
  ): Promise<void> {
    try {
      logger.info('Processing messaging event', {
        senderId: messagingEvent.sender.id,
        recipientId: messagingEvent.recipient.id,
        hasMessage: !!messagingEvent.message,
        hasPostback: !!messagingEvent.postback,
        hasDelivery: !!messagingEvent.delivery,
        hasRead: !!messagingEvent.read
      })

      // Handle incoming message
      if (messagingEvent.message) {
        await this.processIncomingMessage(messagingEvent, platform, pageId)
      }

      // Handle postback (button clicks, etc.)
      if (messagingEvent.postback) {
        await this.processPostback(messagingEvent, platform, pageId)
      }

      // Handle delivery confirmation
      if (messagingEvent.delivery) {
        await this.processDelivery(messagingEvent, platform, pageId)
      }

      // Handle read receipt
      if (messagingEvent.read) {
        await this.processReadReceipt(messagingEvent, platform, pageId)
      }

    } catch (error) {
      logger.error('Error processing messaging event', error instanceof Error ? error : undefined, {
        senderId: messagingEvent.sender.id,
        recipientId: messagingEvent.recipient.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process incoming message
   */
  private async processIncomingMessage(
    messagingEvent: FacebookMessagingEvent,
    platform: 'page' | 'instagram',
    pageId: string
  ): Promise<void> {
    if (!messagingEvent.message) return

    try {
      const message = messagingEvent.message
      const senderId = messagingEvent.sender.id
      const recipientId = messagingEvent.recipient.id
      const messageId = message.mid
      const timestamp = new Date(messagingEvent.timestamp)

      logger.info('Processing incoming message', {
        messageId,
        senderId,
        recipientId,
        hasText: !!message.text,
        hasAttachments: !!message.attachments,
        hasQuickReply: !!message.quick_reply
      })

      // Emit real-time event immediately (best-effort, without DB dependencies)
      try {
        const io = getSocketIO()
        if (io) {
          io.emit('new-message', {
            id: messageId,
            senderId,
            senderName: 'Unknown',
            content: message.text || '',
            timestamp,
            platform: platform.toUpperCase(),
            pageId: recipientId
          })
          emitToAdmin('new-message', {
            id: messageId,
            senderId,
            senderName: 'Unknown',
            content: message.text || '',
            timestamp,
            platform: platform.toUpperCase(),
            pageId: recipientId
          })
        } else {
          logger.warn('Socket.IO not initialized, cannot emit new-message')
        }
      } catch {}

      // Get social account for the page
      const socialAccount = await this.getSocialAccountByPlatformId(recipientId, platform.toUpperCase() as any)
      if (!socialAccount) {
        logger.warn('Social account not found for recipient', { recipientId, platform })
        return
      }

      // Get business information
      const business = await this.getBusinessBySocialAccount(socialAccount.id)
      if (!business) {
        logger.warn('Business not found for social account', { socialAccountId: socialAccount.id })
        return
      }

      // Get sender information
      const senderName = await this.getSenderName(senderId, socialAccount.accessToken)

      try {
        const io = getSocketIO()
        if (io) {
          io.emit('new-message', {
            id: messageId,
            senderId,
            senderName,
            content: message.text || '',
            timestamp,
            platform: platform.toUpperCase(),
            pageId: recipientId,
            businessId: business.id
          })
          emitToAdmin('new-message', {
            id: messageId,
            senderId,
            senderName,
            content: message.text || '',
            timestamp,
            platform: platform.toUpperCase(),
            pageId: recipientId,
            businessId: business.id
          })
        } else {
          logger.warn('Socket.IO not initialized, cannot emit new-message')
        }
      } catch {}

      // Store message in database
      await this.storeMessage({
        messageId,
        senderId,
        senderName,
        content: message.text || '',
        platform: platform.toUpperCase() as any,
        accountId: socialAccount.id,
        businessId: business.id,
        timestamp,
        attachments: message.attachments || [],
        quickReply: message.quick_reply?.payload
      })

      logger.info('Incoming message processed and stored successfully', {
        messageId,
        senderId,
        businessId: business.id
      })

    } catch (error) {
      logger.error('Error processing incoming message', error instanceof Error ? error : undefined, {
        senderId: messagingEvent.sender.id,
        recipientId: messagingEvent.recipient.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process postback event
   */
  private async processPostback(
    messagingEvent: FacebookMessagingEvent,
    platform: 'page' | 'instagram',
    pageId: string
  ): Promise<void> {
    if (!messagingEvent.postback) return

    try {
      const postback = messagingEvent.postback
      const senderId = messagingEvent.sender.id
      const recipientId = messagingEvent.recipient.id

      logger.info('Processing postback event', {
        senderId,
        recipientId,
        payload: postback.payload,
        title: postback.title
      })

      // Handle different postback payloads
      switch (postback.payload) {
        case 'GET_STARTED_PAYLOAD':
          await this.handleGetStarted(senderId, recipientId, platform)
          break
        case 'HELP_PAYLOAD':
          await this.handleHelpRequest(senderId, recipientId, platform)
          break
        default:
          logger.info('Unknown postback payload', { payload: postback.payload })
      }

    } catch (error) {
      logger.error('Error processing postback', error instanceof Error ? error : undefined, {
        senderId: messagingEvent.sender.id,
        recipientId: messagingEvent.recipient.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process delivery confirmation
   */
  private async processDelivery(
    messagingEvent: FacebookMessagingEvent,
    platform: 'page' | 'instagram',
    pageId: string
  ): Promise<void> {
    if (!messagingEvent.delivery) return

    try {
      const delivery = messagingEvent.delivery
      
      logger.info('Processing delivery confirmation', {
        messageIds: delivery.mids,
        watermark: delivery.watermark
      })

      // Update message delivery status in database
      if (delivery.mids && delivery.mids.length > 0) {
        await prisma.chatMessage.updateMany({
          where: {
            messageId: { in: delivery.mids }
          },
          data: {
            deliveredAt: new Date()
          }
        })
      }

    } catch (error) {
      logger.error('Error processing delivery', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process read receipt
   */
  private async processReadReceipt(
    messagingEvent: FacebookMessagingEvent,
    platform: 'page' | 'instagram',
    pageId: string
  ): Promise<void> {
    if (!messagingEvent.read) return

    try {
      const read = messagingEvent.read
      
      logger.info('Processing read receipt', {
        watermark: read.watermark
      })

      // Update message read status in database
      await prisma.chatMessage.updateMany({
        where: {
          timestamp: { lte: new Date(read.watermark) },
          senderId: messagingEvent.sender.id,
          platform: platform.toUpperCase() as any
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })

    } catch (error) {
      logger.error('Error processing read receipt', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process change event
   */
  private async processChange(
    change: any,
    platform: 'page' | 'instagram',
    pageId: string
  ): Promise<void> {
    try {
      logger.info('Processing change event', {
        field: change.field,
        value: JSON.stringify(change.value).substring(0, 200)
      })

      // Handle different types of changes
      switch (change.field) {
        case 'feed':
          await this.processFeedChange(change.value, platform, pageId)
          break
        case 'conversations':
          await this.processConversationChange(change.value, platform, pageId)
          break
        case 'messages':
          await this.processMessageChange(change.value, platform, pageId)
          break
        default:
          logger.info('Unknown change field', { field: change.field })
      }

    } catch (error) {
      logger.error('Error processing change', error instanceof Error ? error : undefined, {
        field: change.field,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process feed change (posts, comments, etc.)
   */
  private async processFeedChange(value: any, platform: 'page' | 'instagram', pageId: string): Promise<void> {
    logger.info('Processing feed change', {
      item: value.item,
      verb: value.verb,
      postId: value.post_id
    })
    // Implementation for feed changes
  }

  /**
   * Process conversation change
   */
  private async processConversationChange(value: any, platform: 'page' | 'instagram', pageId: string): Promise<void> {
    logger.info('Processing conversation change', {
      threadId: value.thread_id,
      action: value.action
    })
    // Implementation for conversation changes
  }

  /**
   * Process message change
   */
  private async processMessageChange(value: any, platform: 'page' | 'instagram', pageId: string): Promise<void> {
    logger.info('Processing message change', {
      messageId: value.message_id,
      action: value.action
    })
    // Implementation for message changes
  }

  /**
   * Handle get started postback
   */
  private async handleGetStarted(senderId: string, recipientId: string, platform: 'page' | 'instagram'): Promise<void> {
    try {
      const welcomeMessage = "Welcome to SocialPiloat.AI! 🎉 I'm here to help you with any questions about our social media management platform. How can I assist you today?"
      
      // Send welcome message (implementation would go here)
      logger.info('Get started handled', { senderId, recipientId, platform })
      
    } catch (error) {
      logger.error('Error handling get started', error instanceof Error ? error : undefined, {
        senderId,
        recipientId,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Handle help request postback
   */
  private async handleHelpRequest(senderId: string, recipientId: string, platform: 'page' | 'instagram'): Promise<void> {
    try {
      const helpMessage = "Here's how I can help you: \n\n📊 Learn about our features\n💰 Get pricing information\n🛠️ Get technical support\n📞 Contact our team\n\nWhat would you like to know about?"
      
      // Send help message (implementation would go here)
      logger.info('Help request handled', { senderId, recipientId, platform })
      
    } catch (error) {
      logger.error('Error handling help request', error instanceof Error ? error : undefined, {
        senderId,
        recipientId,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Store message in database
   */
  private async storeMessage(data: {
    messageId: string
    senderId: string
    senderName: string
    content: string
    platform: 'FACEBOOK' | 'INSTAGRAM'
    accountId: string
    businessId: string
    timestamp: Date
    attachments?: FacebookAttachment[]
    quickReply?: string
  }): Promise<void> {
    try {
      await prisma.chatMessage.create({
        data: {
          platform: data.platform,
          accountId: data.accountId,
          messageId: data.messageId,
          senderId: data.senderId,
          senderName: data.senderName,
          content: data.content,
          timestamp: data.timestamp,
          businessId: data.businessId,
          isRead: false,
          isReplied: false
        }
      })

      logger.info('Message stored successfully', {
        messageId: data.messageId,
        senderId: data.senderId,
        businessId: data.businessId
      })

    } catch (error) {
      logger.error('Error storing message', error instanceof Error ? error : undefined, {
        messageId: data.messageId,
        senderId: data.senderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Get social account by platform ID
   */
  private async getSocialAccountByPlatformId(platformId: string, platform: 'FACEBOOK' | 'INSTAGRAM') {
    try {
      const socialAccount = await prisma.socialAccount.findFirst({
        where: {
          accountId: platformId,
          platform,
          isActive: true
        }
      })
      if (socialAccount) return socialAccount

      // Fallback: search pages inside settings
      const accounts = await prisma.socialAccount.findMany({
        where: { platform, isActive: true }
      })
      for (const acc of accounts) {
        const settings: any = acc.settings as any
        const pages: any[] = (settings && settings.pages) || []
        if (Array.isArray(pages)) {
          for (const p of pages) {
            if (String(p?.id) === String(platformId)) {
              return acc
            }
          }
        }
      }
      return null
    } catch (error) {
      logger.error('Error getting social account', error instanceof Error ? error : undefined, {
        platformId,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Get business by social account
   */
  private async getBusinessBySocialAccount(socialAccountId: string) {
    try {
      const business = await prisma.business.findFirst({
        where: {
          socialAccounts: {
            some: {
              id: socialAccountId
            }
          }
        }
      })
      return business
    } catch (error) {
      logger.error('Error getting business by social account', error instanceof Error ? error : undefined, {
        socialAccountId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Get sender name from Facebook API
   */
  private async getSenderName(senderId: string, accessToken: string): Promise<string> {
    try {
      const url = `https://graph.facebook.com/v18.0/${senderId}?access_token=${accessToken}`
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        return data.first_name || data.name || 'Unknown User'
      } else {
        logger.warn('Failed to get sender name', { senderId, status: response.status })
        return 'Unknown User'
      }
    } catch (error) {
      logger.error('Error getting sender name', error instanceof Error ? error : undefined, {
        senderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return 'Unknown User'
    }
  }
}
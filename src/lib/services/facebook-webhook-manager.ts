import { prisma } from '@/lib/prisma'
import { TokenEncryptionService } from './token-encryption-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

export interface WebhookSubscriptionConfig {
  pageId: string
  pageAccessToken: string
  subscribedFields: string[]
  callbackUrl: string
  verifyToken: string
}

export interface WebhookSubscriptionResult {
  success: boolean
  subscriptionId?: string
  error?: string
  details?: any
}

export class FacebookWebhookManager {
  private readonly encryptionService: TokenEncryptionService

  constructor() {
    this.encryptionService = new TokenEncryptionService()
  }

  /**
   * Subscribe a Facebook page to webhook events
   */
  async subscribePage(config: WebhookSubscriptionConfig): Promise<WebhookSubscriptionResult> {
    try {
      logger.info('Subscribing Facebook page to webhook', { pageId: config.pageId })

      // First, check if the page token is valid and has required permissions
      const tokenValidationUrl = `https://graph.facebook.com/v18.0/me?access_token=${config.pageAccessToken}&fields=id,name,perms`
      const tokenValidationResponse = await fetch(tokenValidationUrl)

      if (!tokenValidationResponse.ok) {
        const tokenError = await tokenValidationResponse.json()
        logger.error('Invalid page access token', { pageId: config.pageId, error: tokenError })
        
        return {
          success: false,
          error: 'Invalid page access token',
          details: tokenError.error?.message || 'Token validation failed'
        }
      }

      const pageInfo = await tokenValidationResponse.json()
      logger.info('Page token validated', { pageId: pageInfo.id, name: pageInfo.name })

      // Check if we already have this page in our database
      const existingPage = await prisma.facebookPage.findUnique({
        where: { facebookPageId: config.pageId }
      })

      if (existingPage && existingPage.webhookSubscribed) {
        logger.info('Page already subscribed to webhook', { pageId: config.pageId })
        return {
          success: true,
          subscriptionId: existingPage.id,
          details: { alreadySubscribed: true }
        }
      }

      // Subscribe to webhook events
      const subscriptionUrl = `https://graph.facebook.com/v18.0/${config.pageId}/subscribed_apps`
      const subscriptionParams = new URLSearchParams({
        access_token: config.pageAccessToken,
        subscribed_fields: config.subscribedFields.join(','),
        callback_url: config.callbackUrl,
        verify_token: config.verifyToken
      })

      const subscriptionResponse = await fetch(`${subscriptionUrl}?${subscriptionParams.toString()}`, {
        method: 'POST'
      })

      if (!subscriptionResponse.ok) {
        const subscriptionError = await subscriptionResponse.json()
        logger.error('Failed to subscribe page to webhook', { 
          pageId: config.pageId, 
          error: subscriptionError,
          status: subscriptionResponse.status 
        })

        // Provide detailed error analysis
        let errorMessage = 'Failed to subscribe page to webhook'
        let errorDetails = subscriptionError.error?.message || 'Unknown error'

        if (subscriptionResponse.status === 400) {
          if (errorDetails.includes('does not exist')) {
            errorMessage = 'Page does not exist or is not accessible'
            errorDetails = 'The page ID provided does not exist or you don\'t have access to it'
          } else if (errorDetails.includes('permissions')) {
            errorMessage = 'Insufficient permissions'
            errorDetails = 'The page access token does not have the required permissions. Please ensure you have: pages_manage_metadata, pages_messaging, pages_read_engagement'
          } else if (errorDetails.includes('expired')) {
            errorMessage = 'Token expired'
            errorDetails = 'The page access token has expired. Please refresh the token.'
          }
        } else if (subscriptionResponse.status === 403) {
          errorMessage = 'Access forbidden'
          errorDetails = 'You do not have permission to subscribe this page to webhooks'
        }

        return {
          success: false,
          error: errorMessage,
          details: errorDetails
        }
      }

      const subscriptionResult = await subscriptionResponse.json()
      logger.info('Page subscribed to webhook successfully', { 
        pageId: config.pageId, 
        result: subscriptionResult 
      })

      // Update database with subscription status
      if (existingPage) {
        await prisma.facebookPage.update({
          where: { id: existingPage.id },
          data: {
            webhookSubscribed: true,
            webhookSubscriptionId: subscriptionResult.success?.toString(),
            subscribedFields: config.subscribedFields,
            lastWebhookSubscription: new Date(),
            connectionStatus: 'CONNECTED'
          }
        })
      } else {
        // Create new page record
        await prisma.facebookPage.create({
          data: {
            facebookPageId: config.pageId,
            name: pageInfo.name,
            webhookSubscribed: true,
            webhookSubscriptionId: subscriptionResult.success?.toString(),
            subscribedFields: config.subscribedFields,
            lastWebhookSubscription: new Date(),
            connectionStatus: 'CONNECTED',
            lastConnectedAt: new Date()
          }
        })
      }

      // Log the successful subscription
      systemMonitor.log('facebook-webhook', 'Page subscribed successfully', 'info', {
        pageId: config.pageId,
        fields: config.subscribedFields,
        callbackUrl: config.callbackUrl
      })

      return {
        success: true,
        subscriptionId: subscriptionResult.success?.toString(),
        details: subscriptionResult
      }

    } catch (error) {
      logger.error('Unexpected error subscribing page to webhook', { 
        pageId: config.pageId, 
        error: error.message 
      })

      return {
        success: false,
        error: 'Unexpected error occurred',
        details: error.message
      }
    }
  }

  /**
   * Unsubscribe a Facebook page from webhook events
   */
  async unsubscribePage(pageId: string, pageAccessToken: string): Promise<WebhookSubscriptionResult> {
    try {
      logger.info('Unsubscribing Facebook page from webhook', { pageId })

      const unsubscribeUrl = `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`
      const params = new URLSearchParams({
        access_token: pageAccessToken
      })

      const response = await fetch(`${unsubscribeUrl}?${params.toString()}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to unsubscribe page from webhook', { pageId, error })
        
        return {
          success: false,
          error: 'Failed to unsubscribe page',
          details: error.error?.message || 'Unknown error'
        }
      }

      const result = await response.json()
      logger.info('Page unsubscribed from webhook successfully', { pageId, result })

      // Update database
      await prisma.facebookPage.update({
        where: { facebookPageId: pageId },
        data: {
          webhookSubscribed: false,
          webhookSubscriptionId: null,
          subscribedFields: [],
          connectionStatus: 'DISCONNECTED'
        }
      })

      systemMonitor.log('facebook-webhook', 'Page unsubscribed successfully', 'info', { pageId })

      return {
        success: true,
        details: result
      }

    } catch (error) {
      logger.error('Unexpected error unsubscribing page from webhook', { pageId, error: error.message })
      
      return {
        success: false,
        error: 'Unexpected error occurred',
        details: error.message
      }
    }
  }

  /**
   * Get webhook subscription status for a page
   */
  async getSubscriptionStatus(pageId: string, pageAccessToken: string): Promise<{
    success: boolean
    subscribed?: boolean
    fields?: string[]
    error?: string
  }> {
    try {
      logger.info('Getting webhook subscription status', { pageId })

      const statusUrl = `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`
      const params = new URLSearchParams({
        access_token: pageAccessToken,
        fields: 'subscribed_fields'
      })

      const response = await fetch(`${statusUrl}?${params.toString()}`)

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to get subscription status', { pageId, error })
        
        return {
          success: false,
          error: error.error?.message || 'Failed to get subscription status'
        }
      }

      const data = await response.json()
      const apps = data.data || []
      
      // Check if our app is subscribed
      const ourAppId = process.env.FACEBOOK_APP_ID
      const ourSubscription = apps.find((app: any) => app.id === ourAppId)

      if (ourSubscription) {
        return {
          success: true,
          subscribed: true,
          fields: ourSubscription.subscribed_fields || []
        }
      } else {
        return {
          success: true,
          subscribed: false,
          fields: []
        }
      }

    } catch (error) {
      logger.error('Unexpected error getting subscription status', { pageId, error: error.message })
      
      return {
        success: false,
        error: 'Unexpected error occurred'
      }
    }
  }

  /**
   * List all webhook events for a page
   */
  async getWebhookEvents(pageId: string, limit: number = 50): Promise<{
    success: boolean
    events?: any[]
    error?: string
  }> {
    try {
      const events = await prisma.facebookWebhookEvent.findMany({
        where: { pageId },
        orderBy: { createdAt: 'desc' },
        take: limit
      })

      return {
        success: true,
        events: events.map(event => ({
          id: event.id,
          eventType: event.eventType,
          senderId: event.senderId,
          recipientId: event.recipientId,
          message: event.message,
          timestamp: event.timestamp,
          rawData: event.rawData,
          processed: event.processed,
          createdAt: event.createdAt
        }))
      }

    } catch (error) {
      logger.error('Failed to fetch webhook events', { pageId, error: error.message })
      
      return {
        success: false,
        error: 'Failed to fetch webhook events'
      }
    }
  }

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(eventData: any): Promise<void> {
    try {
      const { object, entry } = eventData

      if (object !== 'page' || !entry) {
        logger.warn('Invalid webhook event data', { object, hasEntry: !!entry })
        return
      }

      for (const entryItem of entry) {
        const pageId = entryItem.id
        const time = entryItem.time

        if (entryItem.messaging) {
          for (const messagingEvent of entryItem.messaging) {
            await this.processMessagingEvent(pageId, messagingEvent, time)
          }
        }

        if (entryItem.changes) {
          for (const change of entryItem.changes) {
            await this.processPageChange(pageId, change, time)
          }
        }
      }

    } catch (error) {
      logger.error('Error processing webhook event', { error: error.message, eventData })
    }
  }

  /**
   * Process messaging event
   */
  private async processMessagingEvent(pageId: string, event: any, timestamp: number): Promise<void> {
    try {
      const { sender, recipient, message, postback } = event

      let eventType = 'unknown'
      let messageContent = null

      if (message) {
        if (message.text) {
          eventType = 'message'
          messageContent = {
            text: message.text,
            mid: message.mid
          }
        } else if (message.attachments) {
          eventType = 'message_with_attachments'
          messageContent = {
            attachments: message.attachments,
            mid: message.mid
          }
        }
      } else if (postback) {
        eventType = 'postback'
        messageContent = {
          title: postback.title,
          payload: postback.payload
        }
      }

      // Store the event
      await prisma.facebookWebhookEvent.create({
        data: {
          pageId,
          eventType,
          senderId: sender.id,
          recipientId: recipient.id,
          message: messageContent,
          timestamp: new Date(timestamp),
          rawData: event,
          processed: false
        }
      })

      systemMonitor.log('facebook-webhook', 'Messaging event processed', 'info', {
        pageId,
        eventType,
        senderId: sender.id
      })

    } catch (error) {
      logger.error('Error processing messaging event', { pageId, error: error.message, event })
    }
  }

  /**
   * Process page change event
   */
  private async processPageChange(pageId: string, change: any, timestamp: number): Promise<void> {
    try {
      const { field, value } = change

      // Store the event
      await prisma.facebookWebhookEvent.create({
        data: {
          pageId,
          eventType: `page_${field}`,
          senderId: value?.from?.id || 'unknown',
          recipientId: pageId,
          message: value,
          timestamp: new Date(timestamp),
          rawData: change,
          processed: false
        }
      })

      systemMonitor.log('facebook-webhook', 'Page change event processed', 'info', {
        pageId,
        field,
        senderId: value?.from?.id
      })

    } catch (error) {
      logger.error('Error processing page change', { pageId, error: error.message, change })
    }
  }
}
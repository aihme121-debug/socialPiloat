import { prisma } from '@/lib/prisma'
import { TokenEncryptionService } from './token-encryption-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

export interface SendMessageOptions {
  recipientId: string
  message: string
  pageId: string
  pageAccessToken: string
  messagingType?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG'
  tag?: string
}

export interface SendCommentOptions {
  objectId: string // Post ID, Photo ID, etc.
  message: string
  pageId: string
  pageAccessToken: string
}

export interface CreatePostOptions {
  pageId: string
  pageAccessToken: string
  message: string
  link?: string
  picture?: string
  published?: boolean
  scheduledPublishTime?: number
}

export interface FacebookActionResult {
  success: boolean
  messageId?: string
  commentId?: string
  postId?: string
  error?: string
  details?: any
}

export interface FacebookPageInfo {
  id: string
  name: string
  category: string
  accessToken: string
  permissions: string[]
}

export class FacebookActionsService {
  private readonly encryptionService: TokenEncryptionService

  constructor() {
    this.encryptionService = new TokenEncryptionService()
  }

  /**
   * Send a message to a user
   */
  async sendMessage(options: SendMessageOptions): Promise<FacebookActionResult> {
    try {
      logger.info('Sending Facebook message', { 
        recipientId: options.recipientId, 
        pageId: options.pageId,
        messagingType: options.messagingType || 'RESPONSE'
      })

      const messageData: any = {
        recipient: { id: options.recipientId },
        message: { text: options.message },
        messaging_type: options.messagingType || 'RESPONSE'
      }

      if (options.tag) {
        messageData.tag = options.tag
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${options.pageAccessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to send Facebook message', { 
          recipientId: options.recipientId, 
          error: error.error?.message || 'Unknown error'
        })

        return {
          success: false,
          error: error.error?.message || 'Failed to send message',
          details: error
        }
      }

      const result = await response.json()
      const messageId = result.message_id

      logger.info('Facebook message sent successfully', { 
        recipientId: options.recipientId, 
        messageId 
      })

      // Log the action
      await this.logAction({
        pageId: options.pageId,
        actionType: 'SEND_MESSAGE',
        targetId: options.recipientId,
        content: options.message,
        status: 'SUCCESS',
        responseData: result
      })

      systemMonitor.log('facebook-actions', 'Message sent successfully', 'info', {
        pageId: options.pageId,
        recipientId: options.recipientId,
        messageId
      })

      return {
        success: true,
        messageId,
        details: result
      }

    } catch (error) {
      logger.error('Error sending Facebook message', { 
        recipientId: options.recipientId, 
        error: error.message 
      })

      await this.logAction({
        pageId: options.pageId,
        actionType: 'SEND_MESSAGE',
        targetId: options.recipientId,
        content: options.message,
        status: 'FAILED',
        errorMessage: error.message
      })

      return {
        success: false,
        error: 'Failed to send message',
        details: error.message
      }
    }
  }

  /**
   * Send a comment on a post/photo
   */
  async sendComment(options: SendCommentOptions): Promise<FacebookActionResult> {
    try {
      logger.info('Sending Facebook comment', { 
        objectId: options.objectId, 
        pageId: options.pageId 
      })

      const commentData = {
        message: options.message
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${options.objectId}/comments?access_token=${options.pageAccessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commentData)
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to send Facebook comment', { 
          objectId: options.objectId, 
          error: error.error?.message || 'Unknown error'
        })

        return {
          success: false,
          error: error.error?.message || 'Failed to send comment',
          details: error
        }
      }

      const result = await response.json()
      const commentId = result.id

      logger.info('Facebook comment sent successfully', { 
        objectId: options.objectId, 
        commentId 
      })

      // Log the action
      await this.logAction({
        pageId: options.pageId,
        actionType: 'SEND_COMMENT',
        targetId: options.objectId,
        content: options.message,
        status: 'SUCCESS',
        responseData: result
      })

      systemMonitor.log('facebook-actions', 'Comment sent successfully', 'info', {
        pageId: options.pageId,
        objectId: options.objectId,
        commentId
      })

      return {
        success: true,
        commentId,
        details: result
      }

    } catch (error) {
      logger.error('Error sending Facebook comment', { 
        objectId: options.objectId, 
        error: error.message 
      })

      await this.logAction({
        pageId: options.pageId,
        actionType: 'SEND_COMMENT',
        targetId: options.objectId,
        content: options.message,
        status: 'FAILED',
        errorMessage: error.message
      })

      return {
        success: false,
        error: 'Failed to send comment',
        details: error.message
      }
    }
  }

  /**
   * Create a post on the page
   */
  async createPost(options: CreatePostOptions): Promise<FacebookActionResult> {
    try {
      logger.info('Creating Facebook post', { 
        pageId: options.pageId,
        messageLength: options.message.length,
        hasLink: !!options.link,
        hasPicture: !!options.picture
      })

      const postData: any = {
        message: options.message
      }

      if (options.link) {
        postData.link = options.link
      }

      if (options.picture) {
        postData.picture = options.picture
      }

      if (options.published === false) {
        postData.published = false
      }

      if (options.scheduledPublishTime) {
        postData.scheduled_publish_time = options.scheduledPublishTime
      }

      const response = await fetch(`https://graph.facebook.com/v18.0/${options.pageId}/feed?access_token=${options.pageAccessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to create Facebook post', { 
          pageId: options.pageId, 
          error: error.error?.message || 'Unknown error'
        })

        return {
          success: false,
          error: error.error?.message || 'Failed to create post',
          details: error
        }
      }

      const result = await response.json()
      const postId = result.id

      logger.info('Facebook post created successfully', { 
        pageId: options.pageId, 
        postId 
      })

      // Log the action
      await this.logAction({
        pageId: options.pageId,
        actionType: 'CREATE_POST',
        targetId: postId,
        content: options.message,
        status: 'SUCCESS',
        responseData: result
      })

      systemMonitor.log('facebook-actions', 'Post created successfully', 'info', {
        pageId: options.pageId,
        postId
      })

      return {
        success: true,
        postId,
        details: result
      }

    } catch (error) {
      logger.error('Error creating Facebook post', { 
        pageId: options.pageId, 
        error: error.message 
      })

      await this.logAction({
        pageId: options.pageId,
        actionType: 'CREATE_POST',
        targetId: options.pageId,
        content: options.message,
        status: 'FAILED',
        errorMessage: error.message
      })

      return {
        success: false,
        error: 'Failed to create post',
        details: error.message
      }
    }
  }

  /**
   * Get page information and permissions
   */
  async getPageInfo(pageId: string, pageAccessToken: string): Promise<{
    success: boolean
    pageInfo?: FacebookPageInfo
    error?: string
  }> {
    try {
      logger.info('Getting Facebook page info', { pageId })

      const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}?access_token=${pageAccessToken}&fields=id,name,category,perms`)

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to get page info', { pageId, error: error.error?.message })
        
        return {
          success: false,
          error: error.error?.message || 'Failed to get page info'
        }
      }

      const data = await response.json()

      return {
        success: true,
        pageInfo: {
          id: data.id,
          name: data.name,
          category: data.category,
          accessToken: pageAccessToken,
          permissions: data.perms || []
        }
      }

    } catch (error) {
      logger.error('Error getting page info', { pageId, error: error.message })
      
      return {
        success: false,
        error: 'Failed to get page info'
      }
    }
  }

  /**
   * Get recent posts from a page
   */
  async getRecentPosts(pageId: string, pageAccessToken: string, limit: number = 10): Promise<{
    success: boolean
    posts?: any[]
    error?: string
  }> {
    try {
      logger.info('Getting recent posts', { pageId, limit })

      const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/posts?access_token=${pageAccessToken}&limit=${limit}&fields=id,message,created_time,likes.summary(true),comments.summary(true)`)

      if (!response.ok) {
        const error = await response.json()
        logger.error('Failed to get recent posts', { pageId, error: error.error?.message })
        
        return {
          success: false,
          error: error.error?.message || 'Failed to get recent posts'
        }
      }

      const data = await response.json()

      return {
        success: true,
        posts: data.data || []
      }

    } catch (error) {
      logger.error('Error getting recent posts', { pageId, error: error.message })
      
      return {
        success: false,
        error: 'Failed to get recent posts'
      }
    }
  }

  /**
   * Log Facebook action to database
   */
  private async logAction(logData: {
    pageId: string
    actionType: 'SEND_MESSAGE' | 'SEND_COMMENT' | 'CREATE_POST' | 'DELETE_POST' | 'UPDATE_POST'
    targetId: string
    content: string
    status: 'SUCCESS' | 'FAILED' | 'PENDING'
    responseData?: any
    errorMessage?: string
  }): Promise<void> {
    try {
      await prisma.facebookActionsLog.create({
        data: {
          pageId: logData.pageId,
          actionType: logData.actionType,
          targetId: logData.targetId,
          content: logData.content,
          status: logData.status,
          responseData: logData.responseData || null,
          errorMessage: logData.errorMessage || null,
          createdAt: new Date()
        }
      })
    } catch (error) {
      logger.error('Failed to log Facebook action', { error: error.message, logData })
    }
  }

  /**
   * Get action history for a page
   */
  async getActionHistory(pageId: string, limit: number = 50): Promise<{
    success: boolean
    actions?: any[]
    error?: string
  }> {
    try {
      const actions = await prisma.facebookActionsLog.findMany({
        where: { pageId },
        orderBy: { createdAt: 'desc' },
        take: limit
      })

      return {
        success: true,
        actions: actions.map(action => ({
          id: action.id,
          actionType: action.actionType,
          targetId: action.targetId,
          content: action.content,
          status: action.status,
          createdAt: action.createdAt,
          errorMessage: action.errorMessage
        }))
      }

    } catch (error) {
      logger.error('Failed to get action history', { pageId, error: error.message })
      
      return {
        success: false,
        error: 'Failed to get action history'
      }
    }
  }
}
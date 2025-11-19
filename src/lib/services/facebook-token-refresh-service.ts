import { prisma } from '@/lib/prisma'
import { FacebookOAuthService } from './facebook-oauth-service'
import { TokenEncryptionService } from './token-encryption-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

export interface TokenRefreshJob {
  id: string
  facebookAccountId: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  retryCount: number
  maxRetries: number
  scheduledFor: Date
  startedAt?: Date
  completedAt?: Date
  errorMessage?: string
}

export class FacebookTokenRefreshService {
  private readonly encryptionService: TokenEncryptionService
  private readonly oauthService: FacebookOAuthService
  private isProcessing: boolean = false
  private processingInterval: NodeJS.Timeout | null = null

  constructor() {
    this.encryptionService = new TokenEncryptionService()
    
    // Initialize OAuth service with configuration
    const facebookConfig = {
      clientId: process.env.FACEBOOK_APP_ID || '',
      clientSecret: process.env.FACEBOOK_APP_SECRET || '',
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070'}/api/auth/facebook/callback`,
      scopes: [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_metadata',
        'pages_messaging',
        'pages_manage_posts',
        'pages_read_user_content',
        'public_profile',
        'email'
      ]
    }
    
    this.oauthService = new FacebookOAuthService(facebookConfig)
  }

  /**
   * Start the token refresh background processor
   */
  startProcessor(intervalMinutes: number = 30): void {
    if (this.processingInterval) {
      logger.warn('Token refresh processor already running')
      return
    }

    logger.info('Starting Facebook token refresh processor', { intervalMinutes })
    
    // Process immediately on start
    this.processTokenRefreshQueue()

    // Set up recurring processing
    this.processingInterval = setInterval(() => {
      this.processTokenRefreshQueue()
    }, intervalMinutes * 60 * 1000)

    systemMonitor.log('facebook-tokens', 'Token refresh processor started', 'info', { intervalMinutes })
  }

  /**
   * Stop the token refresh background processor
   */
  stopProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
      logger.info('Facebook token refresh processor stopped')
      systemMonitor.log('facebook-tokens', 'Token refresh processor stopped', 'info')
    }
  }

  /**
   * Process the token refresh queue
   */
  private async processTokenRefreshQueue(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Token refresh queue already being processed')
      return
    }

    this.isProcessing = true
    logger.info('Processing Facebook token refresh queue')

    try {
      // Get pending jobs that are due for processing
      const pendingJobs = await prisma.facebookTokenRefreshQueue.findMany({
        where: {
          status: 'PENDING',
          scheduledFor: {
            lte: new Date()
          },
          retryCount: {
            lt: 3 // Max 3 retries
          }
        },
        orderBy: {
          priority: 'desc' // Process HIGH priority first
        },
        take: 10 // Process max 10 jobs per batch
      })

      logger.info(`Found ${pendingJobs.length} token refresh jobs to process`)

      for (const job of pendingJobs) {
        await this.processTokenRefreshJob(job)
      }

    } catch (error) {
      logger.error('Error processing token refresh queue', { error: error.message })
      systemMonitor.log('facebook-tokens', 'Queue processing error', 'error', { error: error.message })
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a single token refresh job
   */
  private async processTokenRefreshJob(job: any): Promise<void> {
    try {
      logger.info('Processing token refresh job', { jobId: job.id, accountId: job.facebookAccountId })

      // Update job status to processing
      await prisma.facebookTokenRefreshQueue.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date()
        }
      })

      // Get the Facebook account
      const account = await prisma.facebookAccount.findUnique({
        where: { id: job.facebookAccountId }
      })

      if (!account) {
        throw new Error(`Facebook account not found: ${job.facebookAccountId}`)
      }

      // Check if token is actually expired or close to expiry (within 1 hour)
      const now = new Date()
      const expiryThreshold = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now

      if (account.tokenExpiresAt > expiryThreshold && !job.forceRefresh) {
        logger.info('Token is not close to expiry, skipping refresh', { 
          accountId: account.id,
          expiresAt: account.tokenExpiresAt,
          threshold: expiryThreshold
        })

        // Mark job as completed
        await prisma.facebookTokenRefreshQueue.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            errorMessage: 'Token not close to expiry'
          }
        })
        return
      }

      // Decrypt the current access token
      const currentAccessToken = this.encryptionService.decrypt(account.accessTokenEncrypted)

      // Validate current token first
      try {
        const tokenInfo = await this.oauthService.validateToken(currentAccessToken)
        logger.info('Current token validation', { 
          isValid: tokenInfo.data.is_valid,
          expiresAt: new Date(tokenInfo.data.expires_at * 1000),
          scopes: tokenInfo.data.scopes
        })
      } catch (error) {
        logger.warn('Current token validation failed', { error: error.message })
      }

      // Attempt to refresh the token using fb_exchange_token
      let newTokenData: any
      try {
        newTokenData = await this.oauthService.refreshAccessToken(currentAccessToken)
        logger.info('Token refreshed successfully', { 
          accountId: account.id,
          expiresIn: newTokenData.expires_in
        })
      } catch (refreshError) {
        logger.error('Token refresh failed', { 
          accountId: account.id,
          error: refreshError.message
        })

        // If refresh fails, try to get a new token using the OAuth flow
        // This would require user interaction, so we'll mark it as failed
        throw new Error(`Token refresh failed: ${refreshError.message}`)
      }

      // Encrypt the new token
      const encryptedNewToken = this.encryptionService.encrypt(newTokenData.access_token)

      // Update the account with new token
      await prisma.facebookAccount.update({
        where: { id: account.id },
        data: {
          accessTokenEncrypted: encryptedNewToken,
          tokenExpiresAt: new Date(now.getTime() + newTokenData.expires_in * 1000),
          lastTokenRefresh: new Date(),
          connectionStatus: 'CONNECTED'
        }
      })

      // Update job as completed
      await prisma.facebookTokenRefreshQueue.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      systemMonitor.log('facebook-tokens', 'Token refreshed successfully', 'info', {
        accountId: account.id,
        expiresIn: newTokenData.expires_in
      })

    } catch (error) {
      logger.error('Token refresh job failed', { 
        jobId: job.id,
        accountId: job.facebookAccountId,
        error: error.message
      })

      // Update job as failed
      await prisma.facebookTokenRefreshQueue.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: error.message,
          retryCount: job.retryCount + 1
        }
      })

      systemMonitor.log('facebook-tokens', 'Token refresh failed', 'error', {
        jobId: job.id,
        accountId: job.facebookAccountId,
        error: error.message
      })

      // Schedule retry if under retry limit
      if (job.retryCount < job.maxRetries) {
        const retryDelay = Math.pow(2, job.retryCount) * 5 * 60 * 1000 // Exponential backoff: 5min, 10min, 20min
        const scheduledFor = new Date(Date.now() + retryDelay)

        await prisma.facebookTokenRefreshQueue.create({
          data: {
            facebookAccountId: job.facebookAccountId,
            priority: job.priority,
            status: 'PENDING',
            retryCount: job.retryCount + 1,
            maxRetries: job.maxRetries,
            scheduledFor,
            forceRefresh: job.forceRefresh
          }
        })

        logger.info('Scheduled token refresh retry', { 
          accountId: job.facebookAccountId,
          retryCount: job.retryCount + 1,
          scheduledFor
        })
      }
    }
  }

  /**
   * Schedule a token refresh job
   */
  async scheduleTokenRefresh(
    facebookAccountId: string, 
    priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM',
    scheduledFor?: Date,
    forceRefresh: boolean = false
  ): Promise<string> {
    try {
      const job = await prisma.facebookTokenRefreshQueue.create({
        data: {
          facebookAccountId,
          priority,
          status: 'PENDING',
          retryCount: 0,
          maxRetries: 3,
          scheduledFor: scheduledFor || new Date(),
          forceRefresh
        }
      })

      logger.info('Token refresh job scheduled', { 
        jobId: job.id,
        accountId: facebookAccountId,
        priority,
        scheduledFor: job.scheduledFor
      })

      systemMonitor.log('facebook-tokens', 'Token refresh scheduled', 'info', {
        accountId: facebookAccountId,
        priority,
        scheduledFor: job.scheduledFor
      })

      return job.id

    } catch (error) {
      logger.error('Failed to schedule token refresh job', { 
        accountId: facebookAccountId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get token refresh queue status
   */
  async getQueueStatus(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    total: number
  }> {
    try {
      const [pending, processing, completed, failed, total] = await Promise.all([
        prisma.facebookTokenRefreshQueue.count({ where: { status: 'PENDING' } }),
        prisma.facebookTokenRefreshQueue.count({ where: { status: 'PROCESSING' } }),
        prisma.facebookTokenRefreshQueue.count({ where: { status: 'COMPLETED' } }),
        prisma.facebookTokenRefreshQueue.count({ where: { status: 'FAILED' } }),
        prisma.facebookTokenRefreshQueue.count()
      ])

      return {
        pending,
        processing,
        completed,
        failed,
        total
      }

    } catch (error) {
      logger.error('Failed to get queue status', { error: error.message })
      throw error
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysToKeep: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const deletedCount = await prisma.facebookTokenRefreshQueue.deleteMany({
        where: {
          status: 'COMPLETED',
          completedAt: {
            lt: cutoffDate
          }
        }
      })

      logger.info('Cleaned up old token refresh jobs', { 
        deletedCount: deletedCount.count,
        daysToKeep
      })

      systemMonitor.log('facebook-tokens', 'Old jobs cleaned up', 'info', {
        deletedCount: deletedCount.count,
        daysToKeep
      })

      return deletedCount.count

    } catch (error) {
      logger.error('Failed to cleanup old jobs', { error: error.message })
      throw error
    }
  }
}
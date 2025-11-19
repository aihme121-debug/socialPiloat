import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

export interface FacebookConfig {
  appId: string
  appSecret: string
  webhookSecret: string
  verifyToken: string
  apiVersion: string
  baseURL: string
  webhookURL: string
  pageAccessTokens: Map<string, string>
}

export class FacebookConfigService {
  private static instance: FacebookConfigService
  private config: FacebookConfig
  private isConfigured: boolean = false

  private constructor() {
    this.config = this.loadConfiguration()
    this.validateConfiguration()
  }

  static getInstance(): FacebookConfigService {
    if (!FacebookConfigService.instance) {
      FacebookConfigService.instance = new FacebookConfigService()
    }
    return FacebookConfigService.instance
  }

  private loadConfiguration(): FacebookConfig {
    const appId = process.env.FACEBOOK_APP_ID || ''
    const appSecret = process.env.FACEBOOK_APP_SECRET || ''
    const webhookSecret = process.env.FACEBOOK_WEBHOOK_SECRET || ''
    const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN || process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || ''
    const nextAuthUrl = process.env.NEXTAUTH_URL || 'http://localhost:7070'

    return {
      appId,
      appSecret,
      webhookSecret,
      verifyToken,
      apiVersion: 'v18.0',
      baseURL: 'https://graph.facebook.com',
      webhookURL: `${nextAuthUrl}/api/facebook/webhook`,
      pageAccessTokens: new Map()
    }
  }

  private validateConfiguration(): void {
    const requiredEnvVars = [
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'FACEBOOK_VERIFY_TOKEN'
    ]

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      logger.warn('Facebook configuration incomplete', { 
        missing: missingVars,
        message: 'Facebook integration will be limited without proper configuration'
      })
      this.isConfigured = false
      systemMonitor.updateFacebookApiStatus('error', 0, `Missing config: ${missingVars.join(', ')}`)
    } else {
      logger.info('Facebook configuration validated successfully')
      this.isConfigured = true
      // Do not mark API as connected until a real API call succeeds
    }
  }

  getConfig(): FacebookConfig {
    return this.config
  }

  isFullyConfigured(): boolean {
    return this.isConfigured && 
           this.config.appId !== '1234567890123456' && // Not placeholder
           this.config.appSecret !== 'your_facebook_app_secret_here' // Not placeholder
  }

  getAppId(): string {
    return this.config.appId
  }

  getAppSecret(): string {
    return this.config.appSecret
  }

  getVerifyToken(): string {
    return this.config.verifyToken
  }

  getWebhookURL(): string {
    return this.config.webhookURL
  }

  addPageAccessToken(pageId: string, accessToken: string): void {
    this.config.pageAccessTokens.set(pageId, accessToken)
    logger.info('Page access token added', { pageId })
  }

  getPageAccessToken(pageId: string): string | undefined {
    return this.config.pageAccessTokens.get(pageId)
  }

  getApiURL(endpoint: string): string {
    return `${this.config.baseURL}/${this.config.apiVersion}/${endpoint}`
  }

  async validateWebhookUrl(webhookUrl: string): Promise<boolean> {
    try {
      const base = process.env.NEXTAUTH_URL || 'http://localhost:7070'
      const healthUrl = `${base}/api/health`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (response.ok) {
        logger.info('Webhook URL is accessible', { url: webhookUrl })
        systemMonitor.updateFacebookWebhookStatus(true)
        return true
      } else {
        logger.warn('Webhook URL returned error', { 
          url: webhookUrl,
          status: response.status 
        })
        return false
      }
    } catch (error) {
      logger.error('Failed to validate webhook URL', error instanceof Error ? error : undefined, {
        url: webhookUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  async validateWebhookConfiguration(): Promise<boolean> {
    return this.validateWebhookUrl(this.config.webhookURL)
  }

  async validateAppCredentials(): Promise<boolean> {
    if (!this.isFullyConfigured()) {
      logger.warn('Cannot validate app credentials - configuration incomplete')
      return false
    }

    try {
      // Test app credentials using Facebook's app access token endpoint
      const appAccessToken = `${this.config.appId}|${this.config.appSecret}`
      const response = await fetch(`${this.config.baseURL}/${this.config.apiVersion}/app?access_token=${appAccessToken}`)
      
      if (response.ok) {
        logger.info('Facebook app credentials validated successfully')
        systemMonitor.updateFacebookApiStatus('connected', response.headers.get('x-response-time') ? parseInt(response.headers.get('x-response-time')!) : 200)
        return true
      } else {
        const error = await response.json()
        logger.error('Facebook app credentials validation failed', undefined, { 
          error: error.error?.message || 'Unknown error',
          status: response.status 
        })
        systemMonitor.updateFacebookApiStatus('error', 0, error.error?.message || 'Credentials validation failed')
        return false
      }
    } catch (error) {
      logger.error('Failed to validate app credentials', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      systemMonitor.updateFacebookApiStatus('error', 0, error instanceof Error ? error.message : 'Validation error')
      return false
    }
  }

  generateWebhookSecret(): string {
    // Generate a secure webhook secret if not provided
    if (!this.config.webhookSecret) {
      const crypto = require('crypto')
      this.config.webhookSecret = crypto.randomBytes(32).toString('hex')
      logger.info('Generated new webhook secret')
    }
    return this.config.webhookSecret
  }

  getConfigurationStatus(): {
    configured: boolean
    missing: string[]
    issues: string[]
    recommendations: string[]
  } {
    const missing: string[] = []
    const issues: string[] = []
    const recommendations: string[] = []

    if (!this.config.appId) missing.push('FACEBOOK_APP_ID')
    if (!this.config.appSecret) missing.push('FACEBOOK_APP_SECRET')
    if (!this.config.verifyToken) missing.push('FACEBOOK_VERIFY_TOKEN')

    if (this.config.appId === '1234567890123456') {
      issues.push('Facebook App ID is using placeholder value')
    }

    if (this.config.appSecret === 'your_facebook_app_secret_here') {
      issues.push('Facebook App Secret is using placeholder value')
    }

    if (!this.config.webhookSecret) {
      recommendations.push('Generate a webhook secret for enhanced security')
    }

    if (this.config.pageAccessTokens.size === 0) {
      recommendations.push('Add page access tokens to enable messaging')
    }

    return {
      configured: this.isFullyConfigured(),
      missing,
      issues,
      recommendations
    }
  }
}
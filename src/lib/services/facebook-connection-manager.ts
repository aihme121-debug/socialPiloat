import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'
import { FacebookConfigService } from './facebook-config-service'
import { EventEmitter } from 'events'

interface ConnectionStatus {
  connected: boolean
  lastConnection: Date
  reconnectAttempts: number
  errorCount: number
  lastError?: string
}

interface ConnectionConfig {
  maxRetries: number
  retryDelay: number
  healthCheckInterval: number
  connectionTimeout: number
}

export class FacebookConnectionManager extends EventEmitter {
  private static instance: FacebookConnectionManager
  private configService: FacebookConfigService
  private connectionStatus: {
    webhook: ConnectionStatus
    api: ConnectionStatus
  }
  private healthCheckInterval?: NodeJS.Timeout
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private isShuttingDown = false
  
  private readonly defaultConfig: ConnectionConfig = {
    maxRetries: 5,
    retryDelay: 5000,
    healthCheckInterval: 30000,
    connectionTimeout: 10000
  }

  private constructor() {
    super()
    this.configService = FacebookConfigService.getInstance()
    this.connectionStatus = {
      webhook: {
        connected: false,
        lastConnection: new Date(),
        reconnectAttempts: 0,
        errorCount: 0
      },
      api: {
        connected: false,
        lastConnection: new Date(),
        reconnectAttempts: 0,
        errorCount: 0
      }
    }
  }

  static getInstance(): FacebookConnectionManager {
    if (!FacebookConnectionManager.instance) {
      FacebookConnectionManager.instance = new FacebookConnectionManager()
    }
    return FacebookConnectionManager.instance
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Facebook connection manager')
    
    // Start health monitoring
    this.startHealthMonitoring()
    
    // Initial connection attempts
    await this.connectWebhook()
    await this.connectApi()
  }

  async connectWebhook(): Promise<boolean> {
    if (this.isShuttingDown) return false

    try {
      logger.info('Attempting to connect Facebook webhook')
      
      const config = this.configService.getConfig()
      if (!config.verifyToken) {
        throw new Error('Webhook verify token not configured')
      }

      // Test webhook endpoint accessibility
      const webhookUrl = config.webhookURL
      const response = await this.testEndpoint(webhookUrl)
      
      if (response.success) {
        this.updateConnectionStatus('webhook', true)
        systemMonitor.updateFacebookWebhookStatus(true)
        logger.info('Facebook webhook connected successfully')
        this.emit('webhook-connected')
        return true
      } else {
        throw new Error(response.error || 'Webhook endpoint test failed')
      }
    } catch (error) {
      this.updateConnectionStatus('webhook', false, error instanceof Error ? error.message : 'Unknown error')
      systemMonitor.updateFacebookWebhookStatus(false, error instanceof Error ? error.message : 'Connection failed')
      logger.error('Facebook webhook connection failed', error instanceof Error ? error : undefined)
      this.scheduleReconnect('webhook')
      return false
    }
  }

  async connectApi(): Promise<boolean> {
    if (this.isShuttingDown) return false

    try {
      logger.info('Attempting to connect Facebook Graph API')
      
      const config = this.configService.getConfig()
      if (!config.appId || !config.appSecret) {
        throw new Error('Facebook app credentials not configured')
      }

      // Test API credentials
      const appAccessToken = `${config.appId}|${config.appSecret}`
      const testUrl = `https://graph.facebook.com/v18.0/app?access_token=${appAccessToken}`
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(this.defaultConfig.connectionTimeout)
      })

      if (response.ok) {
        const data = await response.json()
        this.updateConnectionStatus('api', true)
        systemMonitor.updateFacebookApiStatus('connected', response.headers.get('x-response-time') ? parseInt(response.headers.get('x-response-time')!) : 200)
        logger.info('Facebook Graph API connected successfully', { appId: data.id, name: data.name })
        this.emit('api-connected', data)
        return true
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `API test failed with status ${response.status}`)
      }
    } catch (error) {
      this.updateConnectionStatus('api', false, error instanceof Error ? error.message : 'Unknown error')
      systemMonitor.updateFacebookApiStatus('error', 0, error instanceof Error ? error.message : 'Connection failed')
      logger.error('Facebook Graph API connection failed', error instanceof Error ? error : undefined)
      this.scheduleReconnect('api')
      return false
    }
  }

  async disconnectWebhook(): Promise<void> {
    logger.info('Disconnecting Facebook webhook')
    this.clearRetryTimeout('webhook')
    this.updateConnectionStatus('webhook', false)
    systemMonitor.updateFacebookWebhookStatus(false)
    this.emit('webhook-disconnected')
  }

  async disconnectApi(): Promise<void> {
    logger.info('Disconnecting Facebook Graph API')
    this.clearRetryTimeout('api')
    this.updateConnectionStatus('api', false)
    systemMonitor.updateFacebookApiStatus('disconnected')
    this.emit('api-disconnected')
  }

  private async testEndpoint(url: string): Promise<{ success: boolean; error?: string }> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.defaultConfig.connectionTimeout)
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok || response.status === 404) {
        return { success: true }
      } else {
        return { success: false, error: `Endpoint returned status ${response.status}` }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Connection timeout' }
      }
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  private updateConnectionStatus(type: 'webhook' | 'api', connected: boolean, error?: string): void {
    const status = this.connectionStatus[type]
    status.connected = connected
    status.lastConnection = new Date()
    
    if (connected) {
      status.reconnectAttempts = 0
      status.errorCount = 0
      status.lastError = undefined
    } else {
      status.errorCount++
      status.lastError = error
    }
  }

  private scheduleReconnect(type: 'webhook' | 'api'): void {
    if (this.isShuttingDown) return

    const status = this.connectionStatus[type]
    if (status.reconnectAttempts >= this.defaultConfig.maxRetries) {
      logger.warn(`Max reconnection attempts reached for ${type}`)
      this.emit('max-retries-reached', { type, attempts: status.reconnectAttempts })
      return
    }

    this.clearRetryTimeout(type)
    status.reconnectAttempts++
    
    const delay = this.defaultConfig.retryDelay * Math.pow(2, status.reconnectAttempts - 1) // Exponential backoff
    
    logger.info(`Scheduling ${type} reconnection attempt ${status.reconnectAttempts} in ${delay}ms`)
    
    const timeout = setTimeout(async () => {
      if (type === 'webhook') {
        await this.connectWebhook()
      } else {
        await this.connectApi()
      }
    }, delay)
    
    this.retryTimeouts.set(type, timeout)
  }

  private clearRetryTimeout(type: 'webhook' | 'api'): void {
    const timeout = this.retryTimeouts.get(type)
    if (timeout) {
      clearTimeout(timeout)
      this.retryTimeouts.delete(type)
    }
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return
      
      try {
        // Check webhook health
        if (!this.connectionStatus.webhook.connected) {
          await this.connectWebhook()
        }
        
        // Check API health
        if (!this.connectionStatus.api.connected) {
          await this.connectApi()
        }
      } catch (error) {
        logger.error('Health check failed', error instanceof Error ? error : undefined)
      }
    }, this.defaultConfig.healthCheckInterval)
  }

  getConnectionStatus(): { webhook: ConnectionStatus; api: ConnectionStatus } {
    return {
      webhook: { 
        ...this.connectionStatus.webhook,
        lastConnection: this.connectionStatus.webhook.lastConnection
      },
      api: { 
        ...this.connectionStatus.api,
        lastConnection: this.connectionStatus.api.lastConnection
      }
    }
  }

  isConnected(type: 'webhook' | 'api'): boolean {
    return this.connectionStatus[type].connected
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Facebook connection manager')
    this.isShuttingDown = true
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout))
    this.retryTimeouts.clear()
    
    // Disconnect all services
    await this.disconnectWebhook()
    await this.disconnectApi()
    
    this.removeAllListeners()
  }
}

export const facebookConnectionManager = FacebookConnectionManager.getInstance()
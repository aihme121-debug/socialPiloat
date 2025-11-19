import { EventEmitter } from 'events'
import { logger, LogLevel } from '@/lib/logging/logger-service'
import { SystemLogEntry } from './system-monitor-realtime'

export interface SystemStatus {
  facebook: {
    webhook: {
      connected: boolean
      lastConnection: string
      reconnectAttempts: number
      errorCount: number
    }
    api: {
      status: 'connected' | 'disconnected' | 'error'
      lastResponse: string
      responseTime?: number
      error?: string
    }
  }
  socket: {
    server: {
      running: boolean
      connections: number
      uptime: number
      port: number
    }
    connections: Array<{
      id: string
      connectedAt: string
      userAgent?: string
      ip?: string
    }>
  }
  ngrok: {
    tunnel: {
      active: boolean
      restartCount: number
      url?: string
      establishedAt?: string
    }
  }
  server: {
    uptime: number
    port: number
    restartCount: number
    lastRestart: string
  }
  database: {
    status: 'connected' | 'disconnected' | 'error'
    lastConnection: string
    error?: string
  }
}

export interface BroadcastChannels {
  io?: any
  adminNamespace?: any
}

/**
 * TypeScript version of SystemMonitor for Next.js integration
 */
export class SystemMonitor extends EventEmitter {
  private status: SystemStatus
  private logs: SystemLogEntry[] = []
  private maxLogs = 10000
  private facebookReconnectAttempts = 0
  private ngrokRestartCount = 0
  private serverRestartCount = 0
  private startTime = Date.now()
  private broadcast: BroadcastChannels = {}

  constructor() {
    super()
    this.status = this.initializeStatus()
    this.startMonitoring()
    this.initializeFacebookStatus()
  }

  /**
   * Set up real-time broadcasting
   */
  setupRealTimeBroadcasting(io: any, adminNamespace: any): void {
    this.broadcast.io = io
    this.broadcast.adminNamespace = adminNamespace
    logger.info('Real-time broadcasting setup complete')
  }

  /**
   * Broadcast real-time event
   */
  broadcastEvent(event: string, data: any): void {
    if (this.broadcast.adminNamespace) {
      this.broadcast.adminNamespace.emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      })
    }
  }

  private initializeStatus(): SystemStatus {
    return {
      facebook: {
        webhook: {
          connected: false,
          lastConnection: new Date().toISOString(),
          reconnectAttempts: 0,
          errorCount: 0,
        },
        api: {
          status: 'disconnected',
          lastResponse: new Date().toISOString(),
        },
      },
      socket: {
        server: {
          running: false,
          connections: 0,
          uptime: 0,
          port: 7070,
        },
        connections: [],
      },
      ngrok: {
        tunnel: {
          active: false,
          restartCount: 0,
        },
      },
      server: {
        uptime: 0,
        port: 7070,
        restartCount: 0,
        lastRestart: new Date().toISOString(),
      },
      database: {
        status: 'disconnected',
        lastConnection: new Date().toISOString(),
      },
    }
  }

  private startMonitoring(): void {
    // Update server uptime every 30 seconds
    setInterval(() => {
      this.status.server.uptime = Date.now() - this.startTime
      this.broadcastEvent('system:uptime', { uptime: this.status.server.uptime })
    }, 30000)

    logger.info('System monitoring started', { port: this.status.server.port })
  }

  /**
   * Initialize Facebook status by checking actual connection
   */
  private async initializeFacebookStatus(): Promise<void> {
    try {
      // Check if Facebook is configured
      const { FacebookConfigService } = await import('@/lib/services/facebook-config-service')
      const configService = FacebookConfigService.getInstance()
      
      if (!configService.isFullyConfigured()) {
        logger.info('Facebook not fully configured, skipping status initialization')
        return
      }

      // Check if we have active Facebook accounts
      const { prisma } = await import('@/lib/prisma')
      const facebookAccounts = await prisma.socialAccount.findMany({
        where: { 
          platform: 'FACEBOOK',
          isActive: true 
        }
      })

      if (facebookAccounts.length === 0) {
        logger.info('No active Facebook accounts found')
        return
      }

      // Extract page data and check webhook subscription
      const facebookAccount = facebookAccounts[0]
      const settings = facebookAccount.settings as any || {}
      const pages = settings.pages || []
      
      if (pages.length === 0) {
        logger.info('No Facebook pages found in settings')
        return
      }

      const page = pages[0]
      const pageAccessToken = page.access_token
      const pageId = page.id

      if (!pageAccessToken || !pageId) {
        logger.info('Missing page access token or page ID')
        return
      }

      // Check webhook subscription status
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${pageAccessToken}`
        )

        if (response.ok) {
          const data = await response.json()
          const isSubscribed = data.data && data.data.length > 0
          
          if (isSubscribed) {
            logger.info('Facebook webhook is subscribed and active')
            this.updateFacebookWebhookStatus(true)
          } else {
            logger.info('Facebook webhook is not subscribed')
          }
        } else {
          logger.warn('Failed to check Facebook webhook subscription', { status: response.status })
        }
      } catch (error) {
        logger.error('Error checking Facebook webhook subscription', error instanceof Error ? error : undefined)
      }

      // Test Facebook API connectivity
      try {
        const isValid = await configService.validateAppCredentials()
        if (isValid) {
          logger.info('Facebook API credentials are valid')
        }
      } catch (error) {
        logger.error('Error validating Facebook API credentials', error instanceof Error ? error : undefined)
      }

    } catch (error) {
      logger.error('Error initializing Facebook status', error instanceof Error ? error : undefined)
    }
  }

  /**
   * Update Facebook webhook status
   */
  updateFacebookWebhookStatus(connected: boolean, error?: string): void {
    this.status.facebook.webhook.connected = connected
    this.status.facebook.webhook.lastConnection = new Date().toISOString()
    
    if (connected) {
      this.status.facebook.webhook.errorCount = 0
    } else if (error) {
      this.status.facebook.webhook.errorCount++
    }

    this.broadcastEvent('facebook:webhook:status', {
      connected,
      lastConnection: this.status.facebook.webhook.lastConnection,
      errorCount: this.status.facebook.webhook.errorCount,
    })

    this.log('facebook', `Facebook webhook ${connected ? 'connected' : 'disconnected'}`, 
      connected ? LogLevel.INFO : LogLevel.ERROR, 
      { connected, error }
    )
  }

  /**
   * Update Facebook API status
   */
  updateFacebookApiStatus(
    status: 'connected' | 'disconnected' | 'error',
    responseTime?: number,
    error?: string
  ): void {
    this.status.facebook.api.status = status
    this.status.facebook.api.lastResponse = new Date().toISOString()
    
    if (responseTime) {
      this.status.facebook.api.responseTime = responseTime
    }
    
    if (error) {
      this.status.facebook.api.error = error
    }

    this.broadcastEvent('facebook:api:status', {
      status,
      responseTime,
      error,
    })

    logger.info('Facebook API status updated', { status, responseTime })
  }

  /**
   * Update socket server status
   */
  updateSocketServerStatus(running: boolean, connections: number): void {
    this.status.socket.server.running = running
    this.status.socket.server.connections = connections
    this.status.socket.server.uptime = running ? Date.now() - this.startTime : 0

    this.broadcastEvent('socket:server:status', {
      running,
      connections,
      uptime: this.status.socket.server.uptime,
    })

    logger.info('Socket server status updated', { running, connections })
  }
  logServerRestart(reason?: string): void {
    this.serverRestartCount++
    this.status.server.restartCount = this.serverRestartCount
    this.status.server.lastRestart = new Date().toISOString()
    this.logInfo('server', 'Server restart', { reason, restartCount: this.serverRestartCount })
    this.broadcastEvent('server-restart', {
      reason,
      restartCount: this.serverRestartCount,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Add socket connection
   */
  addSocketConnection(connection: { id: string; userAgent?: string; ip?: string }): void {
    this.status.socket.connections.push({
      ...connection,
      connectedAt: new Date().toISOString(),
    })

    this.broadcastEvent('socket:connection:added', connection)
    logger.info('Socket connection added', { connectionId: connection.id })
  }

  /**
   * Remove socket connection
   */
  removeSocketConnection(connectionId: string): void {
    this.status.socket.connections = this.status.socket.connections.filter(
      (conn) => conn.id !== connectionId
    )

    this.broadcastEvent('socket:connection:removed', { connectionId })
    logger.info('Socket connection removed', { connectionId })
  }

  /**
   * Update ngrok tunnel status
   */
  updateNgrokTunnelStatus(active: boolean, url?: string): void {
    this.status.ngrok.tunnel.active = active
    
    if (url) {
      this.status.ngrok.tunnel.url = url
      this.status.ngrok.tunnel.establishedAt = new Date().toISOString()
    }

    if (!active) {
      this.status.ngrok.tunnel.restartCount++
      this.ngrokRestartCount++
    }

    this.broadcastEvent('ngrok:tunnel:status', {
      active,
      url,
      restartCount: this.status.ngrok.tunnel.restartCount,
    })

    logger.info('Ngrok tunnel status updated', { active, url })
  }
  updateNgrokStatus(active: boolean, url?: string, error?: string): void {
    this.updateNgrokTunnelStatus(active, url)
    if (!active && error) {
      this.logWarn('ngrok', 'ngrok tunnel disconnected', { error })
    }
  }

  /**
   * Update database connection status
   */
  updateDatabaseStatus(status: 'connected' | 'disconnected' | 'error', error?: string): void {
    this.status.database.status = status
    this.status.database.lastConnection = new Date().toISOString()
    
    if (error) {
      this.status.database.error = error
    } else {
      delete this.status.database.error
    }

    this.log('system', `Database ${status}`, 
      status === 'connected' ? LogLevel.INFO : LogLevel.ERROR, 
      { status, error }
    )

    this.emit('database-status', this.status.database)
    this.broadcastEvent('database-status', this.status.database)
  }
  clearLogs(): void {
    this.logs = []
    this.logInfo('system', 'System logs cleared')
    this.broadcastEvent('logs-cleared', { message: 'System logs cleared by user' })
  }
  getSystemStats(): {
    totalLogs: number
    errorRate: number
    facebookConnectionRate: number
    socketConnectionRate: number
    ngrokUptime: number
  } {
    const recentLogs = this.getSystemLogs({ limit: 1000 })
    const errorLogs = recentLogs.filter((log) => log.level === LogLevel.ERROR)
    return {
      totalLogs: this.logs.length,
      errorRate: recentLogs.length ? (errorLogs.length / recentLogs.length) * 100 : 0,
      facebookConnectionRate: this.status.facebook.webhook.connected ? 100 : 0,
      socketConnectionRate: this.status.socket.server.running ? 100 : 0,
      ngrokUptime: this.status.ngrok.tunnel.active
        ? Date.now() - new Date(this.status.ngrok.tunnel.establishedAt || 0).getTime()
        : 0,
    }
  }

  /**
   * Get current system status
   */
  getStatus(): SystemStatus {
    return {
      ...this.status,
      server: {
        ...this.status.server,
        uptime: Date.now() - this.startTime,
      },
    }
  }

  /**
   * Get system logs
   */
  getLogs(limit = 100): any[] {
    return this.logs.slice(-limit)
  }

  /**
   * Update socket server status
   */
  updateSocketStatus(running: boolean, connections: number): void {
    this.status.socket.server.running = running
    this.status.socket.server.connections = connections
    this.status.socket.server.uptime = running ? Date.now() - this.startTime : 0

    this.broadcastEvent('socket:server:status', {
      running,
      connections,
      uptime: this.status.socket.server.uptime,
    })

    logger.info('Socket server status updated', { running, connections })
  }

  /**
   * Get system status (alias for getStatus)
   */
  getSystemStatus(): SystemStatus {
    return this.getStatus()
  }

  /**
   * Get system logs with optional filtering
   */
  getSystemLogs(options: {
    category?: SystemLogEntry['category']
    level?: LogLevel
    limit?: number
    startTime?: string
    endTime?: string
  } = {}): SystemLogEntry[] {
    let logs = [...this.logs]

    if (options.category) {
      logs = logs.filter((log) => log.category === options.category)
    }
    if (options.level) {
      logs = logs.filter((log) => log.level === options.level)
    }
    if (options.startTime) {
      logs = logs.filter((log) => log.timestamp >= (options.startTime || ''))
    }
    if (options.endTime) {
      logs = logs.filter((log) => log.timestamp <= (options.endTime || new Date().toISOString()))
    }

    const limit = options.limit || 100
    return logs.slice(-limit)
  }

  /**
   * Add system log
   */
  addLog(level: string, message: string, details?: any): void {
    const logEntry: SystemLogEntry = {
      timestamp: new Date().toISOString(),
      category: 'system',
      level: level as SystemLogEntry['level'],
      message,
      details,
    }

    this.logs.push(logEntry)

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    logger[level as SystemLogEntry['level']](message, details)
    this.emit('new-log', logEntry)
  }

  /**
   * Log system event (alias for addLog with category)
   */
  log(category: SystemLogEntry['category'], message: string, level: SystemLogEntry['level'] = LogLevel.INFO, details?: Record<string, any>): void {
    const logEntry: SystemLogEntry = {
      timestamp: new Date().toISOString(),
      category,
      level,
      message,
      details
    }

    this.logs.push(logEntry)
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000)
    }

    logger[level](`[${category.toUpperCase()}] ${message}`)
    this.emit('new-log', logEntry)
    this.broadcastEvent('new-log', logEntry)
  }
  logInfo(category: SystemLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.log(category, message, LogLevel.INFO, details)
  }
  logWarn(category: SystemLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.log(category, message, LogLevel.WARN, details)
  }
  logError(category: SystemLogEntry['category'], message: string, error?: Error, details?: Record<string, any>): void {
    this.log(category, message, LogLevel.ERROR, { ...details, error: error?.message, stack: error?.stack })
  }

  /**
   * Update Facebook status with comprehensive updates
   */
  updateFacebookStatus(updates: Partial<SystemStatus['facebook']>): void {
    this.status.facebook = { ...this.status.facebook, ...updates }
    logger.info('Facebook status updated', updates)
    this.emit('facebook-status-changed', this.status.facebook)
    
    // Emit specific events for webhook and API
    if (updates.webhook) {
      this.emit('facebook-webhook', { connected: updates.webhook.connected })
      this.broadcastEvent('facebook-webhook', { connected: updates.webhook.connected })
    }
    if (updates.api) {
      if (updates.api.status === 'connected') {
        this.emit('facebook-api-connected', updates.api)
        this.broadcastEvent('facebook-api-connected', updates.api)
      } else if (updates.api.status === 'error') {
        this.emit('facebook-api-error', updates.api)
        this.broadcastEvent('facebook-api-error', updates.api)
      }
    }
  }

}

// Create singleton instance
export const systemMonitor = new SystemMonitor()
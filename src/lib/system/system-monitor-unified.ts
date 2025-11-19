import { EventEmitter } from 'events'
import { logger, LogLevel } from '@/lib/logging/logger-service'
import { Server as SocketIOServer } from 'socket.io'

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

export interface SystemLogEntry {
  timestamp: string
  category: 'facebook' | 'socket' | 'ngrok' | 'server' | 'system' | 'database'
  level: LogLevel
  message: string
  details?: Record<string, any>
}

export interface BroadcastChannels {
  io?: SocketIOServer
  adminNamespace?: any
}

/**
 * Unified System Monitor - Consolidates all monitoring functionality
 */
export class SystemMonitorUnified extends EventEmitter {
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
  }

  /**
   * Set up real-time broadcasting
   */
  setupRealTimeBroadcasting(io: SocketIOServer, adminNamespace: any): void {
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
    
    // Also emit locally for internal listeners
    this.emit(event, data)
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
    this.log('system', 'System monitoring started', LogLevel.INFO)
    
    // Update uptime every second
    setInterval(() => {
      this.status.server.uptime = Date.now() - this.startTime
      this.status.socket.server.uptime = this.status.server.uptime
    }, 1000)

    // Broadcast status updates every 5 seconds
    setInterval(() => {
      this.broadcastEvent('system-status', this.getSystemStatus())
    }, 5000)
  }

  /**
   * Get current system status
   */
  getSystemStatus(): SystemStatus {
    return { ...this.status }
  }

  /**
   * Get system logs
   */
  getSystemLogs(options: { limit?: number; category?: SystemLogEntry['category']; level?: LogLevel } = {}): SystemLogEntry[] {
    const limit = options.limit || 100
    let logs = [...this.logs]

    if (options.category) {
      logs = logs.filter(log => log.category === options.category)
    }

    if (options.level) {
      logs = logs.filter(log => log.level === options.level)
    }

    return logs.slice(-limit)
  }

  /**
   * Add system log
   */
  addLog(level: LogLevel, message: string, details?: any): void {
    const logEntry: SystemLogEntry = {
      timestamp: new Date().toISOString(),
      category: 'system',
      level,
      message,
      details,
    }

    this.logs.push(logEntry)
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    logger.logMessage(level, message, details)
    this.emit('new-log', logEntry)
    this.broadcastEvent('new-log', logEntry)
  }

  /**
   * Log system event (alias for addLog with category)
   */
  log(category: SystemLogEntry['category'], message: string, level: LogLevel = LogLevel.INFO, details?: Record<string, any>): void {
    const logEntry: SystemLogEntry = {
      timestamp: new Date().toISOString(),
      category,
      level,
      message,
      details,
    }

    this.logs.push(logEntry)
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000)
    }

    logger.logMessage(level, `[${category.toUpperCase()}] ${message}`, details)
    this.emit('new-log', logEntry)
    this.broadcastEvent('new-log', logEntry)
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

    this.log('facebook', `Facebook webhook ${connected ? 'connected' : 'disconnected'}`, 
      connected ? LogLevel.INFO : LogLevel.ERROR, 
      { connected, error }
    )

    this.emit('facebook-webhook-status', this.status.facebook.webhook)
    this.broadcastEvent('facebook-webhook-status', this.status.facebook.webhook)
  }

  /**
   * Update Facebook API status
   */
  updateFacebookApiStatus(status: 'connected' | 'disconnected' | 'error', responseTime?: number, error?: string): void {
    this.status.facebook.api.status = status
    this.status.facebook.api.lastResponse = new Date().toISOString()
    
    if (responseTime) {
      this.status.facebook.api.responseTime = responseTime
    }
    
    if (error) {
      this.status.facebook.api.error = error
    } else {
      delete this.status.facebook.api.error
    }

    this.log('facebook', `Facebook API ${status}`, 
      status === 'connected' ? LogLevel.INFO : LogLevel.ERROR, 
      { status, responseTime, error }
    )

    this.emit('facebook-api-status', this.status.facebook.api)
    this.broadcastEvent('facebook-api-status', this.status.facebook.api)
  }

  /**
   * Update Socket.IO server status
   */
  updateSocketServerStatus(running: boolean, connections?: number): void {
    this.status.socket.server.running = running
    
    if (connections !== undefined) {
      this.status.socket.server.connections = connections
    }

    this.log('socket', `Socket.IO server ${running ? 'started' : 'stopped'}`, LogLevel.INFO, 
      { running, connections }
    )

    this.emit('socket-server-status', this.status.socket.server)
    this.broadcastEvent('socket-server-status', this.status.socket.server)
  }

  /**
   * Add Socket.IO connection
   */
  addSocketConnection(id: string, userAgent?: string, ip?: string): void {
    const connection = {
      id,
      connectedAt: new Date().toISOString(),
      userAgent,
      ip,
    }
    
    this.status.socket.connections.push(connection)
    this.status.socket.server.connections = this.status.socket.connections.length

    this.log('socket', 'New Socket.IO connection', LogLevel.INFO, { id, userAgent, ip })
    
    this.emit('socket-connection-added', connection)
    this.broadcastEvent('socket-connection-added', connection)
  }

  /**
   * Remove Socket.IO connection
   */
  removeSocketConnection(id: string): void {
    const index = this.status.socket.connections.findIndex(conn => conn.id === id)
    if (index !== -1) {
      const connection = this.status.socket.connections.splice(index, 1)[0]
      this.status.socket.server.connections = this.status.socket.connections.length

      this.log('socket', 'Socket.IO connection removed', LogLevel.INFO, { id })
      
      this.emit('socket-connection-removed', connection)
      this.broadcastEvent('socket-connection-removed', connection)
    }
  }

  /**
   * Update ngrok tunnel status
   */
  updateNgrokStatus(active: boolean, url?: string, error?: string): void {
    this.status.ngrok.tunnel.active = active
    
    if (url) {
      this.status.ngrok.tunnel.url = url
      this.status.ngrok.tunnel.establishedAt = new Date().toISOString()
    }

    this.log('ngrok', `ngrok tunnel ${active ? 'active' : 'inactive'}`, 
      active ? LogLevel.INFO : LogLevel.ERROR, 
      { active, url, error }
    )

    this.emit('ngrok-status', this.status.ngrok.tunnel)
    this.broadcastEvent('ngrok-status', this.status.ngrok.tunnel)
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

    this.log('database', `Database ${status}`, 
      status === 'connected' ? LogLevel.INFO : LogLevel.ERROR, 
      { status, error }
    )

    this.emit('database-status', this.status.database)
    this.broadcastEvent('database-status', this.status.database)
  }

  /**
   * Update comprehensive Facebook status
   */
  updateFacebookStatus(updates: Partial<SystemStatus['facebook']>): void {
    this.status.facebook = { ...this.status.facebook, ...updates }
    
    this.log('facebook', 'Facebook status updated', LogLevel.INFO, updates)
    
    // Emit specific events for webhook and API
    if (updates.webhook) {
      this.emit('facebook-webhook', { connected: updates.webhook.connected })
      this.broadcastEvent('facebook-webhook', { connected: updates.webhook.connected })
    }
    
    if (updates.api) {
      this.emit('facebook-api', updates.api)
      this.broadcastEvent('facebook-api', updates.api)
    }
  }
}

// Create singleton instance
export const systemMonitor = new SystemMonitorUnified()
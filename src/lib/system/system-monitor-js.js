// Simple logger implementation for JavaScript version
const LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug'
};

const logger = {
  log: (level, message, details) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : '');
  },
  info: (message, details) => logger.log(LogLevel.INFO, message, details),
  warn: (message, details) => logger.log(LogLevel.WARN, message, details),
  error: (message, details) => logger.log(LogLevel.ERROR, message, details),
  debug: (message, details) => logger.log(LogLevel.DEBUG, message, details)
};

// Simple log persistence for JavaScript version
const logPersistence = {
  addLog: (entry) => {
    // In-memory storage for now
    // In production, this would write to a file or database
    return Promise.resolve();
  }
};

/**
 * JavaScript version of SystemMonitor for direct Node.js usage
 */
class SystemMonitor {
  constructor() {
    this.status = this.initializeStatus();
    this.logs = [];
    this.maxLogs = 10000;
    this.facebookReconnectAttempts = 0;
    this.ngrokRestartCount = 0;
    this.serverRestartCount = 0;
    this.startTime = Date.now();
    this.broadcast = {};
    
    this.startMonitoring();
  }

  /**
   * Set up real-time broadcasting
   */
  setupRealTimeBroadcasting(io, adminNamespace) {
    this.broadcast.io = io;
    this.broadcast.adminNamespace = adminNamespace;
    logger.info('Real-time broadcasting setup complete');
  }

  /**
   * Broadcast real-time event
   */
  broadcastEvent(event, data) {
    if (this.broadcast.adminNamespace) {
      this.broadcast.adminNamespace.emit(event, {
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  initializeStatus() {
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
        memory: {
          used: 0,
          total: 0,
          percentage: 0,
        },
      },
    };
  }

  /**
   * Start system monitoring
   */
  startMonitoring() {
    // Update system metrics every 5 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 5000);

    // Log system status every 5 minutes
    setInterval(() => {
      this.logSystemStatus();
    }, 300000);

    this.logInfo('system', 'System monitoring started');
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.status.server.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };
    this.status.server.uptime = Date.now() - this.startTime;

    // Broadcast real-time update
    this.broadcastEvent('system-status', {
      status: this.status,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      uptime: process.uptime(),
    });
  }

  /**
   * Log system status
   */
  logSystemStatus() {
    this.logInfo('system', 'System status update', {
      facebook: this.status.facebook,
      socket: this.status.socket,
      ngrok: this.status.ngrok,
      server: {
        uptime: this.status.server.uptime,
        restartCount: this.status.server.restartCount,
      },
    });
  }

  /**
   * Log system event
   */
  addLog(category, level, message, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      category,
      level,
      message,
      details,
    };

    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist log to file
    logPersistence.addLog(entry);

    // Also log to main logger
    logger.log(level, `[${category.toUpperCase()}] ${message}`, details);

    // Broadcast new log in real-time
    this.broadcastEvent('new-log', { log: entry });
  }

  /**
   * Log info level system event
   */
  logInfo(category, message, details) {
    this.addLog(category, LogLevel.INFO, message, details);
  }

  /**
   * Log warning level system event
   */
  logWarn(category, message, details) {
    this.addLog(category, LogLevel.WARN, message, details);
  }

  /**
   * Log error level system event
   */
  logError(category, message, error, details) {
    this.addLog(category, LogLevel.ERROR, message, { 
      ...details, 
      error: error?.message, 
      stack: error?.stack 
    });
  }

  /**
   * Facebook Webhook monitoring
   */
  updateFacebookWebhookStatus(connected, disconnectReason) {
    const wasConnected = this.status.facebook.webhook.connected;
    this.status.facebook.webhook.connected = connected;
    this.status.facebook.webhook.lastConnection = new Date().toISOString();
    
    if (connected) {
      this.status.facebook.webhook.reconnectAttempts = 0;
      this.logInfo('facebook', 'Facebook webhook connected');
      
      // Broadcast connection event
      if (!wasConnected) {
        this.broadcastEvent('facebook-webhook', {
          event: 'connected',
          connected: true,
        });
      }
    } else {
      this.status.facebook.webhook.disconnectReason = disconnectReason;
      this.status.facebook.webhook.errorCount++;
      this.logWarn('facebook', 'Facebook webhook disconnected', { reason: disconnectReason });
      
      // Broadcast disconnection event
      if (wasConnected) {
        this.broadcastEvent('facebook-webhook', {
          event: 'disconnected',
          connected: false,
          reason: disconnectReason,
        });
      }
    }
  }

  /**
   * Facebook API monitoring
   */
  updateFacebookApiStatus(status, responseTime, errorMessage) {
    const previousStatus = this.status.facebook.api.status;
    this.status.facebook.api.status = status;
    this.status.facebook.api.lastResponse = new Date().toISOString();
    this.status.facebook.api.responseTime = responseTime;
    this.status.facebook.api.errorMessage = errorMessage;

    if (status === 'error') {
      this.logError('facebook', 'Facebook API error', new Error(errorMessage || 'Unknown error'));
      
      // Broadcast error event
      this.broadcastEvent('facebook-api-error', {
        error: errorMessage,
        responseTime,
      });
    } else if (status === 'connected') {
      this.logInfo('facebook', 'Facebook API connected', { responseTime });
      
      // Broadcast connection event if status changed
      if (previousStatus !== 'connected') {
        this.broadcastEvent('facebook-api-connected', {
          status: 'connected',
          responseTime,
        });
      }
    }
  }

  /**
   * Facebook reconnection attempt
   */
  logFacebookReconnectAttempt() {
    this.status.facebook.webhook.reconnectAttempts++;
    this.logInfo('facebook', `Facebook webhook reconnection attempt ${this.status.facebook.webhook.reconnectAttempts}`);
    
    // Broadcast reconnection attempt
    this.broadcastEvent('facebook-reconnect', {
      attempt: this.status.facebook.webhook.reconnectAttempts,
    });
  }

  /**
   * Socket.IO server monitoring
   */
  updateSocketServerStatus(running, connections) {
    const wasRunning = this.status.socket.server.running;
    this.status.socket.server.running = running;
    this.status.socket.server.connections = connections;
    
    if (running) {
      this.logInfo('socket', 'Socket.IO server started', { connections });
      
      // Broadcast server start event
      if (!wasRunning) {
        this.broadcastEvent('socket-server', {
          event: 'started',
          running: true,
          connections,
        });
      }
    } else {
      this.logWarn('socket', 'Socket.IO server stopped');
      
      // Broadcast server stop event
      if (wasRunning) {
        this.broadcastEvent('socket-server', {
          event: 'stopped',
          running: false,
        });
      }
    }
  }

  /**
   * Socket.IO connection monitoring
   */
  addSocketConnection(socketId) {
    const connection = {
      id: socketId,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    
    this.status.socket.connections.push(connection);
    this.logInfo('socket', 'New Socket.IO connection', { socketId });
    
    // Broadcast connection event
    this.broadcastEvent('socket-connection', {
      event: 'connected',
      socketId,
      totalConnections: this.status.socket.connections.length,
    });
  }

  /**
   * Socket.IO disconnection monitoring
   */
  removeSocketConnection(socketId, reason) {
    const index = this.status.socket.connections.findIndex(conn => conn.id === socketId);
    if (index !== -1) {
      const connection = this.status.socket.connections[index];
      connection.disconnectReason = reason;
      this.status.socket.connections.splice(index, 1);
      this.logInfo('socket', 'Socket.IO connection closed', { socketId, reason });
      
      // Broadcast disconnection event
      this.broadcastEvent('socket-connection', {
        event: 'disconnected',
        socketId,
        reason,
        totalConnections: this.status.socket.connections.length,
      });
    }
  }

  /**
   * Update Socket.IO connection activity
   */
  updateSocketActivity(socketId) {
    const connection = this.status.socket.connections.find(conn => conn.id === socketId);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
    }
  }

  /**
   * ngrok tunnel monitoring
   */
  updateNgrokStatus(active, url, error) {
    const wasActive = this.status.ngrok.tunnel.active;
    this.status.ngrok.tunnel.active = active;
    this.status.ngrok.tunnel.url = url;
    this.status.ngrok.tunnel.lastError = error;
    
    if (active) {
      this.status.ngrok.tunnel.establishedAt = new Date().toISOString();
      this.logInfo('ngrok', 'ngrok tunnel established', { url });
      
      // Broadcast tunnel established event
      if (!wasActive) {
        this.broadcastEvent('ngrok-tunnel', {
          event: 'established',
          active: true,
          url,
        });
      }
    } else {
      this.status.ngrok.tunnel.restartCount++;
      this.logWarn('ngrok', 'ngrok tunnel disconnected', { error });
      
      // Broadcast tunnel disconnected event
      if (wasActive) {
        this.broadcastEvent('ngrok-tunnel', {
          event: 'disconnected',
          active: false,
          error,
        });
      }
    }
  }

  /**
   * Server restart monitoring
   */
  logServerRestart(reason) {
    this.serverRestartCount++;
    this.status.server.restartCount = this.serverRestartCount;
    this.status.server.lastRestart = new Date().toISOString();
    this.logInfo('server', 'Server restart', { reason, restartCount: this.serverRestartCount });
    
    // Broadcast restart event
    this.broadcastEvent('server-restart', {
      reason,
      restartCount: this.serverRestartCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update server port
   */
  updateServerPort(port) {
    this.status.server.port = port;
    this.status.socket.server.port = port;
    this.logInfo('server', 'Server port updated', { port });
    
    // Broadcast port change event
    this.broadcastEvent('server-port', {
      port,
    });
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    return { ...this.status };
  }

  /**
   * Get system logs with filtering
   */
  getSystemLogs(options = {}) {
    let logs = [...this.logs];

    if (options.category) {
      logs = logs.filter(log => log.category === options.category);
    }

    if (options.level) {
      logs = logs.filter(log => log.level === options.level);
    }

    if (options.startTime) {
      logs = logs.filter(log => log.timestamp >= options.startTime);
    }

    if (options.endTime) {
      logs = logs.filter(log => log.timestamp <= options.endTime);
    }

    const limit = options.limit || 100;
    return logs.slice(-limit);
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    const recentLogs = this.getSystemLogs({ limit: 1000 });
    const errorLogs = recentLogs.filter(log => log.level === LogLevel.ERROR);
    
    return {
      totalLogs: this.logs.length,
      errorRate: (errorLogs.length / recentLogs.length) * 100,
      facebookConnectionRate: this.status.facebook.webhook.connected ? 100 : 0,
      socketConnectionRate: this.status.socket.server.running ? 100 : 0,
      ngrokUptime: this.status.ngrok.tunnel.active ? Date.now() - new Date(this.status.ngrok.tunnel.establishedAt || 0).getTime() : 0,
    };
  }

  /**
   * Clear system logs
   */
  clearLogs() {
    this.logs = [];
    this.logInfo('system', 'System logs cleared');
    
    // Broadcast logs cleared event
    this.broadcastEvent('logs-cleared', {
      message: 'System logs cleared by user',
    });
  }
}

// Create singleton instance
const systemMonitor = new SystemMonitor();

module.exports = { systemMonitor };
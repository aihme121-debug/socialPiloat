import { logger, LogLevel } from '@/lib/logging/logger-service';
import { monitoringService } from '@/lib/monitoring/monitoring-service';
import { logPersistence } from './log-persistence';

export interface SystemStatus {
  facebook: {
    webhook: {
      connected: boolean;
      lastConnection: string;
      disconnectReason?: string;
      reconnectAttempts: number;
      errorCount: number;
    };
    api: {
      status: 'connected' | 'disconnected' | 'error';
      lastResponse: string;
      responseTime?: number;
      errorMessage?: string;
    };
  };
  socket: {
    server: {
      running: boolean;
      connections: number;
      uptime: number;
      port: number;
    };
    connections: Array<{
      id: string;
      connectedAt: string;
      lastActivity: string;
      disconnectReason?: string;
    }>;
  };
  ngrok: {
    tunnel: {
      active: boolean;
      url?: string;
      establishedAt?: string;
      lastError?: string;
      restartCount: number;
    };
  };
  server: {
    uptime: number;
    port: number;
    restartCount: number;
    lastRestart: string;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export interface SystemLogEntry {
  timestamp: string;
  category: 'facebook' | 'socket' | 'ngrok' | 'server' | 'system';
  level: LogLevel;
  message: string;
  details?: Record<string, any>;
}

export class SystemMonitor {
  private static instance: SystemMonitor;
  private status: SystemStatus;
  private logs: SystemLogEntry[] = [];
  private maxLogs = 10000;
  private facebookReconnectAttempts = 0;
  private ngrokRestartCount = 0;
  private serverRestartCount = 0;
  private startTime = Date.now();

  private constructor() {
    this.status = this.initializeStatus();
    this.startMonitoring();
  }

  static getInstance(): SystemMonitor {
    if (!SystemMonitor.instance) {
      SystemMonitor.instance = new SystemMonitor();
    }
    return SystemMonitor.instance;
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
  private startMonitoring(): void {
    // Update system metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Log system status every 5 minutes
    setInterval(() => {
      this.logSystemStatus();
    }, 300000);

    this.logInfo('system', 'System monitoring started');
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.status.server.memory = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    };
    this.status.server.uptime = Date.now() - this.startTime;
  }

  /**
   * Log system status
   */
  private logSystemStatus(): void {
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
  private addLog(category: SystemLogEntry['category'], level: LogLevel, message: string, details?: Record<string, any>): void {
    const entry: SystemLogEntry = {
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
    logger.logMessage(level, `[${category.toUpperCase()}] ${message}`, details);
  }

  /**
   * Log info level system event
   */
  logInfo(category: SystemLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.addLog(category, LogLevel.INFO, message, details);
  }

  /**
   * Log warning level system event
   */
  logWarn(category: SystemLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.addLog(category, LogLevel.WARN, message, details);
  }

  /**
   * Log error level system event
   */
  logError(category: SystemLogEntry['category'], message: string, error?: Error, details?: Record<string, any>): void {
    this.addLog(category, LogLevel.ERROR, message, { ...details, error: error?.message, stack: error?.stack });
  }

  /**
   * Facebook Webhook monitoring
   */
  updateFacebookWebhookStatus(connected: boolean, disconnectReason?: string): void {
    this.status.facebook.webhook.connected = connected;
    this.status.facebook.webhook.lastConnection = new Date().toISOString();
    
    if (connected) {
      this.status.facebook.webhook.reconnectAttempts = 0;
      this.logInfo('facebook', 'Facebook webhook connected');
    } else {
      this.status.facebook.webhook.disconnectReason = disconnectReason;
      this.status.facebook.webhook.errorCount++;
      this.logWarn('facebook', 'Facebook webhook disconnected', { reason: disconnectReason });
    }
  }

  /**
   * Facebook API monitoring
   */
  updateFacebookApiStatus(status: SystemStatus['facebook']['api']['status'], responseTime?: number, errorMessage?: string): void {
    this.status.facebook.api.status = status;
    this.status.facebook.api.lastResponse = new Date().toISOString();
    this.status.facebook.api.responseTime = responseTime;
    this.status.facebook.api.errorMessage = errorMessage;

    if (status === 'error') {
      this.logError('facebook', 'Facebook API error', new Error(errorMessage || 'Unknown error'));
    } else if (status === 'connected') {
      this.logInfo('facebook', 'Facebook API connected', { responseTime });
    }
  }

  /**
   * Facebook reconnection attempt
   */
  logFacebookReconnectAttempt(): void {
    this.status.facebook.webhook.reconnectAttempts++;
    this.logInfo('facebook', `Facebook webhook reconnection attempt ${this.status.facebook.webhook.reconnectAttempts}`);
  }

  /**
   * Socket.IO server monitoring
   */
  updateSocketServerStatus(running: boolean, connections: number): void {
    this.status.socket.server.running = running;
    this.status.socket.server.connections = connections;
    
    if (running) {
      this.logInfo('socket', 'Socket.IO server started', { connections });
    } else {
      this.logWarn('socket', 'Socket.IO server stopped');
    }
  }

  /**
   * Socket.IO connection monitoring
   */
  addSocketConnection(socketId: string): void {
    const connection = {
      id: socketId,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    
    this.status.socket.connections.push(connection);
    this.logInfo('socket', 'New Socket.IO connection', { socketId });
  }

  /**
   * Socket.IO disconnection monitoring
   */
  removeSocketConnection(socketId: string, reason?: string): void {
    const index = this.status.socket.connections.findIndex(conn => conn.id === socketId);
    if (index !== -1) {
      const connection = this.status.socket.connections[index];
      connection.disconnectReason = reason;
      this.status.socket.connections.splice(index, 1);
      this.logInfo('socket', 'Socket.IO connection closed', { socketId, reason });
    }
  }

  /**
   * Update Socket.IO connection activity
   */
  updateSocketActivity(socketId: string): void {
    const connection = this.status.socket.connections.find(conn => conn.id === socketId);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
    }
  }

  /**
   * ngrok tunnel monitoring
   */
  updateNgrokStatus(active: boolean, url?: string, error?: string): void {
    this.status.ngrok.tunnel.active = active;
    this.status.ngrok.tunnel.url = url;
    this.status.ngrok.tunnel.lastError = error;
    
    if (active) {
      this.status.ngrok.tunnel.establishedAt = new Date().toISOString();
      this.logInfo('ngrok', 'ngrok tunnel established', { url });
    } else {
      this.status.ngrok.tunnel.restartCount++;
      this.logWarn('ngrok', 'ngrok tunnel disconnected', { error });
    }
  }

  /**
   * Server restart monitoring
   */
  logServerRestart(reason?: string): void {
    this.serverRestartCount++;
    this.status.server.restartCount = this.serverRestartCount;
    this.status.server.lastRestart = new Date().toISOString();
    this.logInfo('server', 'Server restart', { reason, restartCount: this.serverRestartCount });
  }

  /**
   * Update server port
   */
  updateServerPort(port: number): void {
    this.status.server.port = port;
    this.status.socket.server.port = port;
    this.logInfo('server', 'Server port updated', { port });
  }

  /**
   * Get current system status
   */
  getSystemStatus(): SystemStatus {
    return { ...this.status };
  }

  /**
   * Get system logs with filtering
   */
  getSystemLogs(options: {
    category?: SystemLogEntry['category'];
    level?: LogLevel;
    limit?: number;
    startTime?: string;
    endTime?: string;
  } = {}): SystemLogEntry[] {
    let logs = [...this.logs];

    if (options.category) {
      logs = logs.filter(log => log.category === options.category);
    }

    if (options.level) {
      logs = logs.filter(log => log.level === options.level);
    }

    if (options.startTime) {
      logs = logs.filter(log => log.timestamp >= (options.startTime || ''));
    }

    if (options.endTime) {
      logs = logs.filter(log => log.timestamp <= (options.endTime || new Date().toISOString()));
    }

    const limit = options.limit || 100;
    return logs.slice(-limit);
  }

  /**
   * Get system statistics
   */
  getSystemStats(): {
    totalLogs: number;
    errorRate: number;
    facebookConnectionRate: number;
    socketConnectionRate: number;
    ngrokUptime: number;
  } {
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
  clearLogs(): void {
    this.logs = [];
    this.logInfo('system', 'System logs cleared');
  }
}

export const systemMonitor = SystemMonitor.getInstance();
import { monitoringService } from '@/lib/monitoring/monitoring-service';
import { SecurityService } from '@/lib/security/security-service';

const securityService = new SecurityService();

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  maxFileSize: number;
  maxFiles: number;
}

export class LoggerService {
  private static instance: LoggerService;
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private maxLogsInMemory = 1000;

  private constructor() {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: process.env.NODE_ENV !== 'production',
      enableFile: process.env.NODE_ENV === 'production',
      enableRemote: process.env.NODE_ENV === 'production',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    };
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Set logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      metadata,
    };
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const configLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);
    
    return logLevelIndex >= configLevelIndex;
  }

  /**
   * Log to console
   */
  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, entry.context || '', entry.error || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, entry.context || '', entry.error || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, entry.context || '', entry.error || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(logMessage, entry.context || '', entry.error || '');
        break;
    }
  }

  /**
   * Log to file (simplified version - in production would use proper file rotation)
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.config.enableFile) return;

    // In a real implementation, this would write to a file with rotation
    // For now, we'll store in memory and send to monitoring service
    this.logs.push(entry);
    
    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Send errors to monitoring service
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      monitoringService.logError(entry.error || new Error(entry.message), {
        level: entry.level,
        context: entry.context,
        userId: entry.userId,
        sessionId: entry.sessionId,
        requestId: entry.requestId,
      });
    }
  }

  /**
   * Log to remote service
   */
  private async logToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemote) return;

    try {
      // In production, this would send to external logging service
      // For now, we'll send to monitoring service
      if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
        monitoringService.logError(entry.error || new Error(entry.message), {
          level: entry.level,
          context: entry.context,
          userId: entry.userId,
          sessionId: entry.sessionId,
          requestId: entry.requestId,
        });
      }
    } catch (error) {
      console.error('Failed to send log to remote service:', error);
    }
  }

  /**
   * Main logging method
   */
  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error, metadata);
    
    this.logToConsole(entry);
    await this.logToFile(entry);
    await this.logToRemote(entry);
  }

  /**
   * Debug logging
   */
  async debug(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context, undefined, metadata);
  }

  /**
   * Info logging
   */
  async info(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, message, context, undefined, metadata);
  }

  /**
   * Warning logging
   */
  async warn(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARN, message, context, undefined, metadata);
  }

  /**
   * Error logging
   */
  async error(message: string, error?: Error, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.ERROR, message, context, error, metadata);
  }

  /**
   * Fatal logging
   */
  async fatal(message: string, error?: Error, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.FATAL, message, context, error, metadata);
  }

  /**
   * Log API request
   */
  async logRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    requestId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const message = `${method} ${url} ${statusCode} ${responseTime}ms`;
    const context = {
      method,
      url,
      statusCode,
      responseTime,
      userId,
      requestId,
    };

    const level = statusCode >= 500 ? LogLevel.ERROR : 
                  statusCode >= 400 ? LogLevel.WARN : 
                  LogLevel.INFO;

    await this.log(level, message, context, undefined, metadata);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    details?: Record<string, any>
  ): Promise<void> {
    const context = {
      type,
      severity,
      details,
    };

    const level = severity === 'critical' ? LogLevel.FATAL :
                  severity === 'high' ? LogLevel.ERROR :
                  severity === 'medium' ? LogLevel.WARN :
                  LogLevel.INFO;

    await this.log(level, `Security: ${message}`, context);
    
    // Also log to security service
    securityService.logSecurityEvent({
      type,
      severity,
      message,
      metadata: details,
    });
  }

  /**
   * Get recent logs
   */
  getRecentLogs(level?: LogLevel, limit: number = 100): LogEntry[] {
    let logs = this.logs;
    
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    
    return logs.slice(-limit);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = LoggerService.getInstance();
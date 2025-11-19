import fs from 'fs/promises';
import path from 'path';
import { systemMonitor } from './system-monitor';
import { SystemLogEntry } from './system-monitor-realtime';
import { logger } from '@/lib/logging/logger-service';

export interface LogRotationConfig {
  maxFileSize: number; // bytes
  maxFiles: number;
  logDirectory: string;
  flushInterval: number; // milliseconds
}

export class LogPersistenceService {
  private static instance: LogPersistenceService;
  private config: LogRotationConfig;
  private currentLogFile: string;
  private currentFileSize: number = 0;
  private pendingLogs: SystemLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      logDirectory: path.join(process.cwd(), 'logs'),
      flushInterval: 30000, // 30 seconds
    };
    
    this.currentLogFile = this.getCurrentLogFileName();
    this.initialize();
  }

  static getInstance(): LogPersistenceService {
    if (!LogPersistenceService.instance) {
      LogPersistenceService.instance = new LogPersistenceService();
    }
    return LogPersistenceService.instance;
  }

  /**
   * Initialize the log persistence service
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure log directory exists
      await fs.mkdir(this.config.logDirectory, { recursive: true });
      
      // Get current file size
      try {
        const stats = await fs.stat(this.currentLogFile);
        this.currentFileSize = stats.size;
      } catch {
        this.currentFileSize = 0;
      }

      // Start flush timer
      this.startFlushTimer();

      logger.info('Log persistence service initialized', {
        logDirectory: this.config.logDirectory,
        currentFile: this.currentLogFile,
        currentSize: this.currentFileSize,
      });
    } catch (error) {
      logger.error('Failed to initialize log persistence service', error as Error);
    }
  }

  /**
   * Get current log file name based on date
   */
  private getCurrentLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.config.logDirectory, `system-${dateStr}.log`);
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushPendingLogs();
    }, this.config.flushInterval);
  }

  /**
   * Add log entry to pending queue
   */
  addLog(log: SystemLogEntry): void {
    this.pendingLogs.push(log);
    
    // Flush immediately if we have too many pending logs
    if (this.pendingLogs.length >= 100) {
      this.flushPendingLogs();
    }
  }

  /**
   * Flush pending logs to file
   */
  private async flushPendingLogs(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToWrite = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      // Check if we need to rotate the log file
      await this.checkLogRotation();

      // Format logs as JSONL (JSON Lines)
      const logContent = logsToWrite
        .map(log => JSON.stringify(log))
        .join('\n') + '\n';

      // Append to current log file
      await fs.appendFile(this.currentLogFile, logContent, 'utf8');
      
      this.currentFileSize += Buffer.byteLength(logContent, 'utf8');

      logger.debug(`Flushed ${logsToWrite.length} logs to file`, {
        file: this.currentLogFile,
        size: this.currentFileSize,
      });
    } catch (error) {
      logger.error('Failed to flush logs to file', error as Error);
      // Put logs back in pending queue
      this.pendingLogs.unshift(...logsToWrite);
    }
  }

  /**
   * Check if log rotation is needed
   */
  private async checkLogRotation(): Promise<void> {
    if (this.currentFileSize >= this.config.maxFileSize) {
      await this.rotateLogFile();
    }

    // Check if we need to start a new file for the day
    const expectedFileName = this.getCurrentLogFileName();
    if (this.currentLogFile !== expectedFileName) {
      this.currentLogFile = expectedFileName;
      this.currentFileSize = 0;
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLogFile(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFileName = `${this.currentLogFile}.${timestamp}`;
      
      // Rename current file
      await fs.rename(this.currentLogFile, rotatedFileName);
      
      // Reset current file
      this.currentFileSize = 0;
      
      // Clean up old log files
      await this.cleanupOldLogs();

      logger.info('Log file rotated', {
        oldFile: this.currentLogFile,
        newFile: rotatedFileName,
      });
    } catch (error) {
      logger.error('Failed to rotate log file', error as Error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('system-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
        }));

      // Get file stats and sort by modification time
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          try {
            const stats = await fs.stat(file.path);
            return {
              ...file,
              mtime: stats.mtime,
              size: stats.size,
            };
          } catch {
            return null;
          }
        })
      );

      const validFiles = fileStats
        .filter((file): file is NonNullable<typeof file> => file !== null)
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent files
      const filesToDelete = validFiles.slice(this.config.maxFiles);
      
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          logger.info('Deleted old log file', { file: file.name });
        } catch (error) {
          logger.error('Failed to delete old log file', error as Error, { file: file.name });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old logs', error as Error);
    }
  }

  /**
   * Read logs from files with filtering
   */
  async readLogs(options: {
    startTime?: Date;
    endTime?: Date;
    category?: string;
    level?: string;
    limit?: number;
  } = {}): Promise<SystemLogEntry[]> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('system-') && file.endsWith('.log'))
        .map(file => path.join(this.config.logDirectory, file))
        .sort()
        .reverse(); // Most recent first

      const logs: SystemLogEntry[] = [];
      const limit = options.limit || 1000;

      for (const file of logFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const fileLogs = content
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              try {
                return JSON.parse(line);
              } catch {
                return null;
              }
            })
            .filter((log): log is SystemLogEntry => log !== null);

          // Apply filters
          let filteredLogs = fileLogs;

          if (options.startTime) {
            filteredLogs = filteredLogs.filter(log => 
              new Date(log.timestamp) >= options.startTime!
            );
          }

          if (options.endTime) {
            filteredLogs = filteredLogs.filter(log => 
              new Date(log.timestamp) <= options.endTime!
            );
          }

          if (options.category) {
            filteredLogs = filteredLogs.filter(log => log.category === options.category);
          }

          if (options.level) {
            filteredLogs = filteredLogs.filter(log => log.level === options.level);
          }

          logs.push(...filteredLogs);

          // Stop if we have enough logs
          if (logs.length >= limit) {
            break;
          }
        } catch (error) {
          logger.error('Failed to read log file', error as Error, { file });
        }
      }

      return logs.slice(0, limit);
    } catch (error) {
      logger.error('Failed to read logs', error as Error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: string;
    newestFile?: string;
  }> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files.filter(file => file.startsWith('system-') && file.endsWith('.log'));
      
      let totalSize = 0;
      let oldestFile: string | undefined;
      let newestFile: string | undefined;
      let oldestTime = Infinity;
      let newestTime = 0;

      for (const file of logFiles) {
        const filePath = path.join(this.config.logDirectory, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          
          const mtime = stats.mtime.getTime();
          if (mtime < oldestTime) {
            oldestTime = mtime;
            oldestFile = file;
          }
          if (mtime > newestTime) {
            newestTime = mtime;
            newestFile = file;
          }
        } catch {
          // Ignore file errors
        }
      }

      return {
        totalFiles: logFiles.length,
        totalSize,
        oldestFile,
        newestFile,
      };
    } catch (error) {
      logger.error('Failed to get log stats', error as Error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining logs
    await this.flushPendingLogs();

    logger.info('Log persistence service shutdown complete');
  }
}

export const logPersistence = LogPersistenceService.getInstance();
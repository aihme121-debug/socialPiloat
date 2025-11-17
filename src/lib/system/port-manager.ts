import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/logging/logger-service';

const execAsync = promisify(exec);

export class PortManager {
  private static instance: PortManager;
  private readonly targetPort = 7070;

  private constructor() {}

  static getInstance(): PortManager {
    if (!PortManager.instance) {
      PortManager.instance = new PortManager();
    }
    return PortManager.instance;
  }

  /**
   * Check if a port is occupied
   */
  async isPortOccupied(port: number): Promise<boolean> {
    try {
      // For Windows
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      return stdout.trim().length > 0;
    } catch (error) {
      // If netstat fails, assume port is free
      return false;
    }
  }

  /**
   * Get process ID using a specific port
   */
  async getProcessUsingPort(port: number): Promise<number | null> {
    try {
      // For Windows
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(pid)) {
            return pid;
          }
        }
      }
      return null;
    } catch (error) {
      logger.error('Failed to get process using port', error as Error, { port });
      return null;
    }
  }

  /**
   * Kill process by PID
   */
  async killProcess(pid: number): Promise<boolean> {
    try {
      await execAsync(`taskkill /PID ${pid} /F`);
      logger.info(`Successfully killed process ${pid}`);
      return true;
    } catch (error) {
      logger.error(`Failed to kill process ${pid}`, error as Error);
      return false;
    }
  }

  /**
   * Terminate process using a specific port
   */
  async terminateProcessUsingPort(port: number): Promise<boolean> {
    const pid = await this.getProcessUsingPort(port);
    if (!pid) {
      logger.warn(`No process found using port ${port}`);
      return false;
    }

    logger.info(`Found process ${pid} using port ${port}, terminating...`);
    return await this.killProcess(pid);
  }

  /**
   * Ensure port is available by terminating any existing processes
   */
  async ensurePortAvailable(port: number = this.targetPort): Promise<void> {
    logger.info(`Checking if port ${port} is available...`);
    
    const isOccupied = await this.isPortOccupied(port);
    if (!isOccupied) {
      logger.info(`Port ${port} is available`);
      return;
    }

    logger.warn(`Port ${port} is occupied, attempting to free it...`);
    const terminated = await this.terminateProcessUsingPort(port);
    
    if (terminated) {
      logger.info(`Successfully freed port ${port}`);
    } else {
      logger.error(`Failed to free port ${port}`);
      throw new Error(`Unable to free port ${port}`);
    }

    // Wait a moment for the port to be fully released
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Get the target port (7070)
   */
  getTargetPort(): number {
    return this.targetPort;
  }
}

export const portManager = PortManager.getInstance();
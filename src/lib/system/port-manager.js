const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Port management utility for SocialPiloat AI
 * Handles port checking, process termination, and cleanup
 */
class PortManager {
  constructor() {
    this.ports = new Map();
  }

  /**
   * Check if a port is currently in use
   * @param {number} port - Port number to check
   * @returns {Promise<boolean>} - True if port is in use
   */
  async isPortInUse(port) {
    try {
      // Try to connect to the port
      const net = require('net');
      return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        server.once('listening', () => {
          server.close();
          resolve(false);
        });
        
        server.listen(port);
      });
    } catch (error) {
      console.error(`Error checking port ${port}:`, error.message);
      return false;
    }
  }

  /**
   * Get process ID (PID) using a specific port
   * @param {number} port - Port number
   * @returns {Promise<number|null>} - PID of process using the port, or null
   */
  async getProcessIdByPort(port) {
    try {
      let command;
      
      if (process.platform === 'win32') {
        // Windows: Use netstat to find PID
        command = `netstat -ano | findstr :${port} | findstr LISTENING`;
        const { stdout } = await execAsync(command);
        
        if (stdout) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
              const pid = parseInt(parts[parts.length - 1], 10);
              if (!isNaN(pid) && pid > 0) {
                return pid;
              }
            }
          }
        }
      } else {
        // Unix-like: Use lsof or netstat
        try {
          command = `lsof -ti:${port}`;
          const { stdout } = await execAsync(command);
          const pid = parseInt(stdout.trim(), 10);
          return !isNaN(pid) && pid > 0 ? pid : null;
        } catch {
          // Fallback to netstat
          command = `netstat -tlnp 2>/dev/null | grep :${port} | grep LISTEN`;
          const { stdout } = await execAsync(command);
          
          if (stdout) {
            const match = stdout.match(/(\d+)\//);
            if (match) {
              const pid = parseInt(match[1], 10);
              return !isNaN(pid) && pid > 0 ? pid : null;
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting process ID for port ${port}:`, error.message);
      return null;
    }
  }

  /**
   * Get process information by PID
   * @param {number} pid - Process ID
   * @returns {Promise<Object|null>} - Process information
   */
  async getProcessInfo(pid) {
    try {
      let command;
      
      if (process.platform === 'win32') {
        // Windows: Use tasklist
        command = `tasklist /FI "PID eq ${pid}" /FO CSV /NH`;
        const { stdout } = await execAsync(command);
        
        if (stdout && stdout.includes(',')) {
          const parts = stdout.split(',').map(part => part.replace(/"/g, '').trim());
          return {
            name: parts[0] || 'Unknown',
            pid: pid,
            memUsage: parts[4] || 'Unknown'
          };
        }
      } else {
        // Unix-like: Use ps
        command = `ps -p ${pid} -o pid,ppid,cmd,%mem --no-headers`;
        const { stdout } = await execAsync(command);
        
        if (stdout) {
          const parts = stdout.trim().split(/\s+/);
          return {
            name: parts.slice(2).join(' ') || 'Unknown',
            pid: pid,
            ppid: parseInt(parts[1], 10) || 0,
            memUsage: parts[parts.length - 1] || 'Unknown'
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting process info for PID ${pid}:`, error.message);
      return null;
    }
  }

  /**
   * Kill a process by PID
   * @param {number} pid - Process ID to kill
   * @param {boolean} force - Force kill (SIGKILL vs SIGTERM)
   * @returns {Promise<boolean>} - True if successful
   */
  async killProcess(pid, force = false) {
    try {
      let command;
      
      if (process.platform === 'win32') {
        // Windows: Use taskkill
        command = `taskkill ${force ? '/F' : ''} /PID ${pid}`;
      } else {
        // Unix-like: Use kill
        command = `kill ${force ? '-9' : '-15'} ${pid}`;
      }
      
      await execAsync(command);
      console.log(`✅ Process ${pid} terminated successfully`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to kill process ${pid}:`, error.message);
      return false;
    }
  }

  /**
   * Free a port by killing the process using it
   * @param {number} port - Port number to free
   * @param {boolean} force - Force kill if normal termination fails
   * @returns {Promise<boolean>} - True if port was freed
   */
  async freePort(port, force = false) {
    try {
      console.log(`🔍 Checking if port ${port} is in use...`);
      
      if (!(await this.isPortInUse(port))) {
        console.log(`✅ Port ${port} is already free`);
        return true;
      }
      
      console.log(`🔍 Finding process using port ${port}...`);
      const pid = await this.getProcessIdByPort(port);
      
      if (!pid) {
        console.error(`❌ Could not find process using port ${port}`);
        return false;
      }
      
      console.log(`📋 Found process ${pid} using port ${port}`);
      const processInfo = await this.getProcessInfo(pid);
      
      if (processInfo) {
        console.log(`📝 Process details: ${processInfo.name} (PID: ${pid})`);
      }
      
      console.log(`🛑 Terminating process ${pid}...`);
      const killed = await this.killProcess(pid, force);
      
      if (!killed && !force) {
        console.log(`⚠️  Normal termination failed, trying force kill...`);
        return await this.killProcess(pid, true);
      }
      
      // Wait a moment for the port to be released
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify the port is now free
      const isStillInUse = await this.isPortInUse(port);
      if (isStillInUse) {
        console.error(`❌ Port ${port} is still in use after killing process`);
        return false;
      }
      
      console.log(`✅ Port ${port} freed successfully`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error freeing port ${port}:`, error.message);
      return false;
    }
  }

  /**
   * Get all ports currently being tracked
   * @returns {Array} - Array of port information
   */
  getTrackedPorts() {
    return Array.from(this.ports.entries()).map(([port, info]) => ({
      port: parseInt(port, 10),
      ...info
    }));
  }

  /**
   * Track a port for monitoring
   * @param {number} port - Port number
   * @param {string} service - Service name
   * @param {string} description - Service description
   */
  trackPort(port, service, description = '') {
    this.ports.set(port.toString(), {
      service,
      description,
      trackedAt: new Date().toISOString()
    });
  }

  /**
   * Stop tracking a port
   * @param {number} port - Port number
   */
  untrackPort(port) {
    this.ports.delete(port.toString());
  }
}

module.exports = PortManager;
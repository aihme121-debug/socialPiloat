#!/usr/bin/env node

const { spawn } = require('child_process');
const { exec } = require('child_process');
const { promisify } = require('util');

/**
 * Enhanced startup script for SocialPiloat AI
 * Handles port management, monitoring, and automatic restarts
 */

const TARGET_PORT = 7070;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 5000; // 5 seconds

let restartCount = 0;
let serverProcess = null;
let isShuttingDown = false;

const execAsync = promisify(exec);

/**
 * Log startup event
 */
function logStartup(message, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [STARTUP] ${message}`, details);
}

/**
 * Check if port is occupied
 */
async function isPortOccupied(port) {
  try {
    // For Windows
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get process ID using a specific port
 */
async function getProcessUsingPort(port) {
  try {
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
    return null;
  }
}

/**
 * Kill process by PID
 */
async function killProcess(pid) {
  try {
    await execAsync(`taskkill /PID ${pid} /F`);
    logStartup(`Successfully killed process ${pid}`);
    return true;
  } catch (error) {
    logStartup(`Failed to kill process ${pid}`, { error: error.message });
    return false;
  }
}

/**
 * Terminate process using a specific port
 */
async function terminateProcessUsingPort(port) {
  const pid = await getProcessUsingPort(port);
  if (!pid) {
    logStartup(`No process found using port ${port}`);
    return false;
  }

  logStartup(`Found process ${pid} using port ${port}, terminating...`);
  return await killProcess(pid);
}

/**
 * Ensure port is available by terminating any existing processes
 */
async function ensurePortAvailable(port) {
  logStartup(`Checking if port ${port} is available...`);
  
  const isOccupied = await isPortOccupied(port);
  if (!isOccupied) {
    logStartup(`Port ${port} is available`);
    return;
  }

  logStartup(`Port ${port} is occupied, attempting to free it...`);
  const terminated = await terminateProcessUsingPort(port);
  
  if (terminated) {
    logStartup(`Successfully freed port ${port}`);
  } else {
    logStartup(`Failed to free port ${port}`);
    throw new Error(`Unable to free port ${port}`);
  }

  // Wait a moment for the port to be fully released
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Handle graceful shutdown
 */
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logStartup(`Received ${signal}, initiating graceful shutdown...`);

  try {
    // Kill server process
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise((resolve) => {
        serverProcess.on('exit', resolve);
        setTimeout(resolve, 5000); // Force kill after 5 seconds
      });
    }

    logStartup('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logStartup('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

/**
 * Start ngrok tunnel
 */
async function startNgrok() {
  return new Promise((resolve, reject) => {
    const ngrok = spawn('ngrok', ['http', TARGET_PORT.toString(), '--log', 'stdout']);
    
    ngrok.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('ngrok:', output);
      
      // Extract tunnel URL from ngrok output
      const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.ngrok\.io/);
      if (urlMatch) {
        const tunnelUrl = urlMatch[0];
        console.log(`🌐 ngrok tunnel established: ${tunnelUrl}`);
        resolve(tunnelUrl);
      }
    });

    ngrok.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('ngrok error:', error);
    });

    ngrok.on('close', (code) => {
      console.log(`ngrok process exited with code ${code}`);
      
      // Restart ngrok after a delay
      setTimeout(() => {
        console.log('🔄 Restarting ngrok...');
        startNgrok().catch(err => console.error('Failed to restart ngrok:', err));
      }, 5000);
    });

    ngrok.on('error', (error) => {
      console.error('❌ Failed to start ngrok:', error);
      reject(error);
    });
  });
}

/**
 * Start the server
 */
async function startServer() {
  try {
    logStartup('Starting SocialPiloat AI server...');

    // Ensure port 7070 is available
    logStartup(`Ensuring port ${TARGET_PORT} is available...`);
    await ensurePortAvailable(TARGET_PORT);

    // Start the enhanced server
  logStartup('Starting enhanced server...');
  serverProcess = spawn('node', ['server-enhanced-simple.js'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: TARGET_PORT.toString() },
  });

    serverProcess.on('error', (error) => {
      logStartup('Server process error', { error: error.message });
    });

    serverProcess.on('exit', (code, signal) => {
      if (isShuttingDown) return;

      logStartup('Server process exited', { code, signal, restartCount });

      if (restartCount < MAX_RESTART_ATTEMPTS) {
        restartCount++;
        logStartup(`Restarting server (attempt ${restartCount}/${MAX_RESTART_ATTEMPTS})...`);
        
        setTimeout(() => {
          startServer().catch((error) => {
            logStartup('Failed to restart server', { error: error.message });
            process.exit(1);
          });
        }, RESTART_DELAY);
      } else {
        logStartup('Maximum restart attempts reached, giving up');
        process.exit(1);
      }
    });

    // Reset restart count on successful start
    serverProcess.on('spawn', () => {
      restartCount = 0;
      logStartup('✅ Server process spawned successfully');
    });

    // Start ngrok in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('🌐 Starting ngrok tunnel...');
      try {
        await startNgrok();
        console.log('✅ ngrok tunnel started');
      } catch (error) {
        console.warn('⚠️  Failed to start ngrok:', error.message);
      }
    }

  } catch (error) {
    logStartup('Failed to start server', { error: error.message });
    
    if (restartCount < MAX_RESTART_ATTEMPTS) {
      restartCount++;
      logStartup(`Retrying server start (attempt ${restartCount}/${MAX_RESTART_ATTEMPTS})...`);
      
      setTimeout(() => {
        startServer().catch((error) => {
          logStartup('Failed to restart server', { error: error.message });
          process.exit(1);
        });
      }, RESTART_DELAY);
    } else {
      process.exit(1);
    }
  }
}

/**
 * Setup signal handlers
 */
function setupSignalHandlers() {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logStartup('Uncaught exception', { error: error.message, stack: error.stack });
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason, promise) => {
    logStartup('Unhandled rejection', { reason, promise });
    gracefulShutdown('unhandledRejection');
  });
}

/**
 * Main function
 */
async function main() {
  logStartup('SocialPiloat AI Enhanced Startup Script');
  logStartup('Environment', { 
    NODE_ENV: process.env.NODE_ENV,
    PORT: TARGET_PORT,
    PID: process.pid 
  });

  // Setup signal handlers
  setupSignalHandlers();

  // Start the server
  await startServer();
}

// Start the application
main().catch((error) => {
  logStartup('Fatal error in main', { error: error.message });
  process.exit(1);
});
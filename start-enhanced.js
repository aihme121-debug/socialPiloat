#!/usr/bin/env node

const { spawn } = require('child_process');
const { portManager } = require('./src/lib/system/port-manager');
const { systemMonitor } = require('./src/lib/system/system-monitor');
const { logPersistence } = require('./src/lib/system/log-persistence');

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

/**
 * Log startup event
 */
function logStartup(message, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [STARTUP] ${message}`, details);
  systemMonitor.logInfo('system', message, details);
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

    // Shutdown services
    await logPersistence.shutdown();
    
    logStartup('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logStartup('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

/**
 * Start the server
 */
async function startServer() {
  try {
    logStartup('Starting SocialPiloat AI server...');

    // Ensure port is available
    logStartup(`Ensuring port ${TARGET_PORT} is available...`);
    await portManager.ensurePortAvailable(TARGET_PORT);

    // Start the enhanced server
    logStartup('Starting enhanced server...');
    serverProcess = spawn('node', ['server-enhanced.js'], {
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
      logStartup('Server process spawned successfully');
    });

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
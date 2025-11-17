#!/usr/bin/env node

/**
 * Next.js Development Server with Port 7070 and Ngrok Integration
 * This script ensures Next.js runs on port 7070 with automatic ngrok setup
 */

const { spawn } = require('child_process');
const path = require('path');
const PortManager = require('./src/lib/system/port-manager');
const NgrokManager = require('./src/lib/system/ngrok-manager');

const PORT = 7070;
const MAX_RESTART_ATTEMPTS = 3;
const RESTART_DELAY = 2000;

let restartCount = 0;
let ngrokManager = null;
let nextjsProcess = null;

console.log('🚀 SocialPiloat AI - Next.js Development Server with Ngrok');
console.log('=====================================================');

/**
 * Log system events
 */
function logEvent(level, message, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, 
    Object.keys(details).length > 0 ? JSON.stringify(details) : '');
}

/**
 * Update environment variables with ngrok URLs (delegated to NgrokManager)
 */
async function updateEnvironmentWithNgrok(publicUrl) {
  // NgrokManager now handles this internally
  logEvent('info', 'Environment variables updated with ngrok URLs', {
    publicUrl
  });
}

/**
 * Start ngrok tunnel using NgrokManager
 */
async function startNgrok() {
  ngrokManager = new NgrokManager(PORT);
  
  try {
    // Check if ngrok is installed
    const isInstalled = await NgrokManager.isInstalled();
    if (!isInstalled) {
      throw new Error('Ngrok is not installed. Install it from https://ngrok.com/download');
    }
    
    console.log('🌐 Starting ngrok tunnel...');
    const publicUrl = await ngrokManager.start();
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Ngrok startup failed:', error.message);
    throw error;
  }
}

/**
 * Start Next.js development server
 */
async function startNextjs() {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting Next.js development server on port ${PORT}...`);
    
    nextjsProcess = spawn('npx', ['next', 'dev', '-p', PORT.toString()], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: PORT.toString() }
    });
    
    nextjsProcess.on('spawn', () => {
      console.log('✅ Next.js process spawned successfully');
      logEvent('info', 'Next.js development server started', { port: PORT });
    });
    
    nextjsProcess.on('error', (error) => {
      console.error('❌ Next.js process error:', error.message);
      logEvent('error', 'Next.js startup failed', { error: error.message });
      reject(error);
    });
    
    nextjsProcess.on('exit', (code, signal) => {
      console.log(`🛑 Next.js exited with code ${code} and signal ${signal}`);
      logEvent('warn', 'Next.js process exited', { code, signal });
      
      if (code !== 0 && !signal) {
        reject(new Error(`Next.js exited with code ${code}`));
      }
    });
    
    // Give Next.js time to start up
    setTimeout(() => {
      console.log(`✅ Next.js development server should be running on http://localhost:${PORT}`);
      resolve();
    }, 5000);
  });
}

/**
 * Main startup function
 */
async function start() {
  const portManager = new PortManager();
  
  try {
    console.log(`🔍 Checking if port ${PORT} is available...`);
    
    // Check and free port 7070 if needed
    const portFreed = await portManager.freePort(PORT, false);
    if (!portFreed) {
      console.error(`❌ Failed to free port ${PORT}`);
      process.exit(1);
    }
    
    console.log(`✅ Port ${PORT} is ready`);
    
    // Start Next.js
    await startNextjs();
    
    // Start ngrok (optional - won't fail if ngrok is not installed)
    try {
      console.log('🌐 Starting ngrok tunnel...');
      const publicUrl = await startNgrok();
      console.log(`🎉 Development environment ready!`);
      console.log(`📱 Local: http://localhost:${PORT}`);
      console.log(`🌐 Public: ${publicUrl}`);
    } catch (ngrokError) {
      console.warn('⚠️  Ngrok setup failed (optional):', ngrokError.message);
      console.log(`🎉 Development environment ready without ngrok!`);
      console.log(`📱 Local: http://localhost:${PORT}`);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      
      if (nextjsProcess) {
        nextjsProcess.kill('SIGTERM');
      }
      
      if (ngrokManager) {
        ngrokManager.stop();
      }
      
      setTimeout(() => {
        console.log('✅ Shutdown complete');
        process.exit(0);
      }, 2000);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down...');
      
      if (nextjsProcess) {
        nextjsProcess.kill('SIGTERM');
      }
      
      if (ngrokManager) {
        ngrokManager.stop();
      }
      
      setTimeout(() => {
        console.log('✅ Shutdown complete');
        process.exit(0);
      }, 2000);
    });
    
  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    logEvent('error', 'Development server startup failed', { error: error.message });
    process.exit(1);
  }
}

// Start the development server
if (require.main === module) {
  start().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { start, startNextjs, startNgrok };
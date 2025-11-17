const { spawn } = require('child_process');
const path = require('path');

// Configuration
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 3000; // 3 seconds
const MONITORING_PORT = 7070;

let restartCount = 0;
let isShuttingDown = false;

console.log('🚀 SocialPiloat AI - Real-Time Monitoring System');
console.log('==============================================');

function logSystemEvent(level, message, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    details,
    category: 'system'
  };
  
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : '');
}

function startServer() {
  if (isShuttingDown) {
    console.log('🛑 Shutdown in progress, not restarting server');
    return;
  }

  if (restartCount >= MAX_RESTART_ATTEMPTS) {
    console.error('❌ Maximum restart attempts reached. Exiting.');
    logSystemEvent('error', 'Maximum restart attempts reached', { 
      maxAttempts: MAX_RESTART_ATTEMPTS,
      restartCount 
    });
    process.exit(1);
  }

  restartCount++;
  console.log(`🔄 Starting server (attempt ${restartCount}/${MAX_RESTART_ATTEMPTS})...`);
  logSystemEvent('info', 'Starting enhanced server with real-time monitoring', { 
    attempt: restartCount,
    maxAttempts: MAX_RESTART_ATTEMPTS 
  });

  // Use the real-time enhanced server
  const serverPath = path.join(__dirname, 'server-realtime.js');
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  server.on('spawn', () => {
    console.log('✅ Server process spawned successfully');
    logSystemEvent('info', 'Server process started', { pid: server.pid });
  });

  server.on('error', (error) => {
    console.error('❌ Failed to start server:', error);
    logSystemEvent('error', 'Server startup failed', { error: error.message });
    
    if (!isShuttingDown && restartCount < MAX_RESTART_ATTEMPTS) {
      console.log(`⏱️  Restarting in ${RESTART_DELAY/1000} seconds...`);
      setTimeout(startServer, RESTART_DELAY);
    }
  });

  server.on('exit', (code, signal) => {
    console.log(`🛑 Server exited with code ${code} and signal ${signal}`);
    logSystemEvent('warn', 'Server process exited', { code, signal, restartCount });
    
    if (!isShuttingDown) {
      if (code === 0) {
        console.log('✅ Server exited normally');
        logSystemEvent('info', 'Server exited normally');
      } else {
        console.error(`❌ Server crashed with exit code ${code}`);
        logSystemEvent('error', 'Server crashed', { exitCode: code });
        
        if (restartCount < MAX_RESTART_ATTEMPTS) {
          console.log(`⏱️  Restarting in ${RESTART_DELAY/1000} seconds...`);
          setTimeout(startServer, RESTART_DELAY);
        } else {
          console.error('❌ Maximum restart attempts reached');
          logSystemEvent('error', 'Maximum restart attempts reached');
          process.exit(1);
        }
      }
    }
  });

  return server;
}

function setupGracefulShutdown() {
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    logSystemEvent('info', 'Shutdown signal received', { signal });
    
    isShuttingDown = true;
    
    // Give processes time to clean up
    setTimeout(() => {
      console.log('✅ Graceful shutdown complete');
      logSystemEvent('info', 'Graceful shutdown complete');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    logSystemEvent('error', 'Uncaught exception', { error: error.message, stack: error.stack });
    shutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    logSystemEvent('error', 'Unhandled promise rejection', { reason, promise });
    shutdown('unhandledRejection');
  });
}

function checkPortAvailability() {
  const net = require('net');
  const server = net.createServer();
  
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${MONITORING_PORT} is already in use`);
        logSystemEvent('error', 'Port already in use', { port: MONITORING_PORT });
        reject(new Error(`Port ${MONITORING_PORT} is already in use`));
      } else {
        reject(err);
      }
    });
    
    server.once('listening', () => {
      server.close();
      console.log(`✅ Port ${MONITORING_PORT} is available`);
      logSystemEvent('info', 'Port availability confirmed', { port: MONITORING_PORT });
      resolve(true);
    });
    
    server.listen(MONITORING_PORT);
  });
}

async function main() {
  try {
    console.log('🔍 Checking system requirements...');
    
    // Check if Node.js is available
    const nodeVersion = process.version;
    console.log(`✅ Node.js version: ${nodeVersion}`);
    logSystemEvent('info', 'Node.js version check', { version: nodeVersion });
    
    // Check port availability
    await checkPortAvailability();
    
    console.log('🚀 Starting real-time monitoring system...');
    logSystemEvent('info', 'Real-time monitoring system startup initiated');
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Start the server
    startServer();
    
    console.log('');
    console.log('🎯 Real-time monitoring features:');
    console.log('   ✅ Live system status updates every 5 seconds');
    console.log('   ✅ Real-time log streaming');
    console.log('   ✅ Socket.IO connection monitoring');
    console.log('   ✅ Facebook webhook status tracking');
    console.log('   ✅ ngrok tunnel monitoring');
    console.log('   ✅ Server restart detection');
    console.log('   ✅ Memory usage tracking');
    console.log('   ✅ Error notifications');
    console.log('');
    console.log('📊 Admin Dashboard: http://localhost:7070/admin-dashboard-realtime.html');
    console.log('🔧 API Status: http://localhost:7070/api/admin/system-status/realtime');
    console.log('📋 Real-time Logs: http://localhost:7070/api/admin/system-logs/realtime');
    console.log('💓 Health Check: http://localhost:7070/api/health');
    console.log('');
    console.log('⚡ Real-time monitoring is now active!');
    
  } catch (error) {
    console.error('❌ Failed to start monitoring system:', error);
    logSystemEvent('error', 'Monitoring system startup failed', { error: error.message });
    process.exit(1);
  }
}

// Start the monitoring system
main();
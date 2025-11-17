const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { spawn } = require('child_process');
const { initializeSocket } = require('./socket-server');
const { portManager } = require('./src/lib/system/port-manager');
const { systemMonitor } = require('./src/lib/system/system-monitor');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const targetPort = 7070;

// Configure Next.js app
const app = next({ dev, hostname, port: targetPort });
const handle = app.getRequestHandler();

/**
 * Start ngrok tunnel
 */
async function startNgrok() {
  return new Promise((resolve, reject) => {
    const ngrok = spawn('ngrok', ['http', targetPort.toString(), '--log', 'stdout']);
    
    ngrok.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('ngrok:', output);
      
      // Extract tunnel URL from ngrok output
      const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.ngrok\.io/);
      if (urlMatch) {
        const tunnelUrl = urlMatch[0];
        console.log(`ngrok tunnel established: ${tunnelUrl}`);
        systemMonitor.updateNgrokStatus(true, tunnelUrl);
        resolve(tunnelUrl);
      }
    });

    ngrok.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('ngrok error:', error);
      systemMonitor.updateNgrokStatus(false, undefined, error);
    });

    ngrok.on('close', (code) => {
      console.log(`ngrok process exited with code ${code}`);
      systemMonitor.updateNgrokStatus(false, undefined, `Process exited with code ${code}`);
      
      // Restart ngrok after a delay
      setTimeout(() => {
        console.log('Restarting ngrok...');
        startNgrok().catch(err => console.error('Failed to restart ngrok:', err));
      }, 5000);
    });

    ngrok.on('error', (error) => {
      console.error('Failed to start ngrok:', error);
      systemMonitor.updateNgrokStatus(false, undefined, error.message);
      reject(error);
    });
  });
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    
    systemMonitor.logInfo('system', 'Server shutdown initiated', { signal });
    
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Main server startup function
 */
async function startServer() {
  try {
    console.log('🚀 Starting SocialPiloat AI Server...');
    
    // Log server restart
    systemMonitor.logServerRestart('Server startup initiated');
    
    // Ensure port 7070 is available
    console.log('Checking port availability...');
    await portManager.ensurePortAvailable(targetPort);
    systemMonitor.updateServerPort(targetPort);
    
    // Prepare Next.js app
    console.log('Preparing Next.js application...');
    await app.prepare();
    
    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        systemMonitor.logError('server', 'Request handling error', err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    // Initialize Socket.io
    console.log('Initializing Socket.io...');
    initializeSocket(server);
    systemMonitor.updateSocketServerStatus(true, 0);
    
    // Setup graceful shutdown
    setupGracefulShutdown(server);

    // Start server
    server.listen(targetPort, (err) => {
      if (err) {
        console.error('Failed to start server:', err);
        systemMonitor.logError('server', 'Server startup failed', err);
        throw err;
      }
      
      console.log(`> ✅ Ready on http://${hostname}:${targetPort}`);
      console.log(`> 📡 Socket.io server integrated`);
      systemMonitor.logInfo('server', 'Server started successfully', { 
        port: targetPort, 
        hostname,
        environment: process.env.NODE_ENV 
      });
    });

    // Start ngrok in development mode
    if (dev) {
      console.log('🌐 Starting ngrok tunnel...');
      try {
        await startNgrok();
        console.log('✅ ngrok tunnel started');
      } catch (error) {
        console.warn('⚠️  Failed to start ngrok:', error.message);
        systemMonitor.logWarn('ngrok', 'Failed to start ngrok tunnel', { error: error.message });
      }
    }

    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      systemMonitor.logError('server', 'Server error occurred', error);
      
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${targetPort} is already in use`);
        systemMonitor.logError('server', 'Port conflict detected', error);
      }
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    systemMonitor.logError('system', 'Server startup failed', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error('Unhandled server startup error:', error);
  process.exit(1);
});
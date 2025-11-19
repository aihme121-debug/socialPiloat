#!/usr/bin/env node

/**
 * Next.js Custom Server with Socket.IO Integration
 * Runs Next.js on port 7070 with real-time monitoring capabilities
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { initializeSocketIO } = require('./src/lib/socket/socket-server');
const PortManager = require('./src/lib/system/port-manager');
const NgrokManager = require('./src/lib/system/ngrok-manager');
const { systemMonitor } = require('./src/lib/system/system-monitor-js');
const { prisma } = require('./src/lib/prisma');
const { FacebookConnectionManager } = require('./src/lib/services/facebook-connection-manager');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 7070;

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let ngrokManager = null;

/**
 * Start the server with Socket.IO integration
 */
async function startServer() {
  const portManager = new PortManager();
  
  try {
    console.log('🚀 SocialPiloat AI - Next.js Custom Server with Socket.IO');
    console.log('=======================================================');
    
    // Free port 7070 if needed
    console.log(`🔍 Checking if port ${port} is available...`);
    const portFreed = await portManager.freePort(port, false);
    if (!portFreed) {
      console.error(`❌ Failed to free port ${port}`);
      process.exit(1);
    }
    console.log(`✅ Port ${port} is ready`);
    
    // Prepare Next.js
    console.log('📦 Preparing Next.js...');
    await app.prepare();
    
    // Test database connection
    console.log('🗄️ Testing database connection...');
    try {
      await prisma.$queryRaw`SELECT 1`;
      systemMonitor.updateDatabaseStatus('connected');
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      systemMonitor.updateDatabaseStatus('disconnected', error.message);
    }
    
    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        // Parse the URL
        const parsedUrl = parse(req.url, true);
        const { pathname, query } = parsedUrl;
        
        // Handle admin dashboard static files
        if (pathname === '/admin-dashboard-realtime.html' || pathname === '/admin-dashboard.html') {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join(__dirname, 'public', pathname);
          
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'text/html');
            res.end(content);
            return;
          }
        }
        
        // Handle Socket.IO client library
        if (pathname === '/socket.io/socket.io.js') {
          const fs = require('fs');
          const path = require('path');
          const socketClientPath = path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js');
          
          if (fs.existsSync(socketClientPath)) {
            const content = fs.readFileSync(socketClientPath, 'utf8');
            res.setHeader('Content-Type', 'application/javascript');
            res.end(content);
            return;
          }
        }
        
        // Update Facebook webhook connection status hints
        if (pathname === '/api/facebook/webhook') {
          try {
            if (req.method === 'GET') {
              const mode = query['hub.mode'];
              const token = query['hub.verify_token'];
              if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
                systemMonitor.updateFacebookWebhookStatus(true);
              }
            } else if (req.method === 'POST') {
              systemMonitor.updateFacebookWebhookStatus(true);
            }
          } catch {}
        }

        // Handle all other requests with Next.js
        await handle(req, res, parsedUrl);
        
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
    
    // Initialize Socket.IO
    console.log('🔌 Initializing Socket.IO...');
    const io = initializeSocketIO(server);
    
    // Initialize Facebook connection manager
    console.log('📘 Initializing Facebook connection manager...');
    try {
      const facebookConnectionManager = new FacebookConnectionManager();
      await facebookConnectionManager.initialize();
      console.log('✅ Facebook connection manager initialized');
      
      // Store reference for later use
      global.facebookConnectionManager = facebookConnectionManager;
    } catch (fbError) {
      console.error('❌ Failed to initialize Facebook connection manager:', fbError);
      systemMonitor.logError('facebook', 'Connection manager initialization failed', fbError);
    }
    
    // Start server
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`✅ Server ready on http://${hostname}:${port}`);
      console.log(`📱 Local: http://localhost:${port}`);
      
      // Update system monitor with server and Socket.IO status
      console.log('🔧 Updating system monitor status...');
      systemMonitor.updateSocketServerStatus(true, 0);
      systemMonitor.updateServerPort(port);
      console.log('✅ System monitor status updated');
      
      // Start ngrok if available
      startNgrok();
    });
    
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

/**
 * Start ngrok tunnel
 */
async function startNgrok() {
  try {
    ngrokManager = new NgrokManager(port);
    
    // Check if ngrok is installed
    const isInstalled = await NgrokManager.isInstalled();
    if (!isInstalled) {
      console.log('⚠️  Ngrok is not installed. Install from https://ngrok.com/download');
      return;
    }
    
    console.log('🌐 Starting ngrok tunnel...');
    const publicUrl = await ngrokManager.start();
    
    console.log(`🎉 Development environment ready!`);
    console.log(`📱 Local: http://localhost:${port}`);
    console.log(`🌐 Public: ${publicUrl}`);
    
  } catch (ngrokError) {
    console.warn('⚠️  Ngrok setup failed (optional):', ngrokError.message);
    console.log(`🎉 Development environment ready without ngrok!`);
    console.log(`📱 Local: http://localhost:${port}`);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  
  if (ngrokManager) {
    ngrokManager.stop();
  }
  
  app.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  
  if (ngrokManager) {
    ngrokManager.stop();
  }
  
  app.close();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
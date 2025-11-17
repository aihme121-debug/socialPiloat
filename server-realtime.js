const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { systemMonitor } = require('./src/lib/system/system-monitor-js.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '7070', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let io = null;
let connectionCount = 0;
let adminNamespace = null;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Create admin namespace for monitoring
  adminNamespace = io.of('/admin');
  
  adminNamespace.on('connection', (socket) => {
    console.log('🔧 Admin dashboard connected:', socket.id);
    
    // Send current status immediately
    socket.emit('system-status', {
      status: systemMonitor.getSystemStatus(),
      timestamp: new Date().toISOString(),
    });
    
    // Send recent logs
    socket.emit('system-logs', {
      logs: systemMonitor.getSystemLogs({ limit: 50 }),
      timestamp: new Date().toISOString(),
    });
    
    socket.on('disconnect', () => {
      console.log('🔧 Admin dashboard disconnected:', socket.id);
    });
  });

  // Regular namespace for app functionality
  io.on('connection', (socket) => {
    connectionCount++;
    console.log('👤 User connected:', socket.id, 'Total connections:', connectionCount);
    
    // Monitor socket connections
    systemMonitor.addSocketConnection(socket.id);
    systemMonitor.updateSocketServerStatus(true, connectionCount);
    
    // Broadcast connection update to admin dashboard
    if (adminNamespace) {
      adminNamespace.emit('socket-connection', {
        event: 'connected',
        socketId: socket.id,
        totalConnections: connectionCount,
        timestamp: new Date().toISOString(),
      });
    }

    socket.on('join-conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`💬 User ${socket.id} joined conversation ${conversationId}`);
      
      // Log to admin dashboard
      if (adminNamespace) {
        adminNamespace.emit('activity', {
          type: 'conversation-join',
          socketId: socket.id,
          conversationId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(conversationId);
      console.log(`💬 User ${socket.id} left conversation ${conversationId}`);
      
      // Log to admin dashboard
      if (adminNamespace) {
        adminNamespace.emit('activity', {
          type: 'conversation-leave',
          socketId: socket.id,
          conversationId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
      socket.to(conversationId).emit('user-typing', { userId, isTyping });
      
      // Log typing activity
      systemMonitor.updateSocketActivity(socket.id);
    });

    socket.on('message-read', ({ conversationId, messageId, userId }) => {
      socket.to(conversationId).emit('message-read-status', { messageId, userId });
      
      // Log read status
      systemMonitor.updateSocketActivity(socket.id);
    });

    socket.on('disconnect', (reason) => {
      connectionCount--;
      console.log('👤 User disconnected:', socket.id, 'Reason:', reason, 'Total connections:', connectionCount);
      
      // Monitor disconnection
      systemMonitor.removeSocketConnection(socket.id, reason);
      systemMonitor.updateSocketServerStatus(connectionCount > 0, connectionCount);
      
      // Broadcast disconnection to admin dashboard
      if (adminNamespace) {
        adminNamespace.emit('socket-connection', {
          event: 'disconnected',
          socketId: socket.id,
          reason,
          totalConnections: connectionCount,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      systemMonitor.logError('socket', 'Socket.IO error', error);
      
      // Broadcast error to admin dashboard
      if (adminNamespace) {
        adminNamespace.emit('error', {
          type: 'socket-error',
          socketId: socket.id,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  console.log('📡 Socket.io server initialized with admin namespace');
  return io;
};

// Function to broadcast system events to admin dashboard
function broadcastToAdmin(event, data) {
  if (adminNamespace) {
    adminNamespace.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}

// Enhanced system monitoring with real-time updates
function startRealTimeMonitoring() {
  // Update system metrics every 5 seconds and broadcast
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const systemStatus = systemMonitor.getSystemStatus();
    
    broadcastToAdmin('system-status', {
      status: systemStatus,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      uptime: process.uptime(),
    });
  }, 5000);

  // Broadcast new logs as they occur
  const originalAddLog = systemMonitor.addLog.bind(systemMonitor);
  systemMonitor.addLog = function(category, level, message, details) {
    originalAddLog(category, level, message, details);
    
    // Get the latest log entry
    const logs = systemMonitor.getSystemLogs({ limit: 1 });
    if (logs.length > 0) {
      broadcastToAdmin('new-log', {
        log: logs[0],
      });
    }
  };

  // Monitor system events
  systemMonitor.logInfo('system', 'Real-time monitoring started');
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      
      // Handle API requests with monitoring
      if (parsedUrl.pathname.startsWith('/api/')) {
        const startTime = Date.now();
        
        // Log API request
        systemMonitor.logInfo('server', 'API request', {
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
        });
      }
      
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('❌ Error occurred handling', req.url, err);
      systemMonitor.logError('server', 'Request handling error', err, {
        url: req.url,
        method: req.method,
      });
      
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  initializeSocket(server);
  
  // Start real-time monitoring
  startRealTimeMonitoring();

  server
    .once('error', (err) => {
      console.error('❌ Server error:', err);
      systemMonitor.logError('server', 'Server startup error', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> ✅ Ready on http://${hostname}:${port}`);
      console.log(`> 📡 Socket.io server integrated with real-time monitoring`);
      console.log(`> 🔧 Admin dashboard available at /admin-dashboard.html`);
      console.log(`> ⚡ Real-time monitoring active`);
      
      systemMonitor.updateSocketServerStatus(true, 0);
      systemMonitor.logInfo('server', 'Enhanced server started', {
        port,
        hostname,
        nodeVersion: process.version,
        platform: process.platform,
      });
    });
}).catch((err) => {
  console.error('❌ Error starting server:', err);
  systemMonitor.logError('server', 'Server initialization error', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  systemMonitor.logInfo('server', 'Server shutdown initiated (SIGTERM)');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  systemMonitor.logInfo('server', 'Server shutdown initiated (SIGINT)');
  process.exit(0);
});

// Export for use in other modules
module.exports = { io, broadcastToAdmin };
const { Server: SocketIOServer } = require('socket.io');
const { Server: HTTPServer } = require('http');
const { systemMonitor } = require('../system/system-monitor-js');

/**
 * Socket.IO server integration for Next.js
 * Provides real-time monitoring capabilities
 */

let io = null;

/**
 * Initialize Socket.IO server
 * @param {HTTPServer} httpServer - HTTP server instance
 * @returns {SocketIOServer} Socket.IO server instance
 */
function initializeSocketIO(httpServer) {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_SITE_URL || true
        : ['http://localhost:3000', 'http://localhost:7070'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/socket.io',
    serveClient: true
  });

  // Admin namespace for monitoring dashboard
  const adminNamespace = io.of('/admin');
  
  adminNamespace.on('connection', (socket) => {
    console.log('🔌 Admin dashboard connected:', socket.id);
    
    // Send initial system status
    const status = systemMonitor.getSystemStatus();
    socket.emit('system-status', {
      status: 'connected',
      timestamp: new Date().toISOString(),
      socketId: socket.id,
      systemStatus: status
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('❌ Admin dashboard disconnected:', socket.id, 'Reason:', reason);
    });

    // Handle client requests
    socket.on('get-system-status', () => {
      const status = systemMonitor.getSystemStatus();
      socket.emit('system-status', {
        status: 'online',
        timestamp: new Date().toISOString(),
        systemStatus: status
      });
    });

    // Handle log requests
    socket.on('get-system-logs', () => {
      const logs = systemMonitor.getSystemLogs({ limit: 100 });
      socket.emit('system-logs', {
        logs: logs,
        timestamp: new Date().toISOString()
      });
    });
  });

  // Set up periodic status updates
  const statusInterval = setInterval(() => {
    if (adminNamespace) {
      const status = systemMonitor.getSystemStatus();
      console.log('📡 Broadcasting system status:', JSON.stringify(status, null, 2));
      adminNamespace.emit('system-status', {
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        systemStatus: status
      });
    }
  }, 5000); // Every 5 seconds

  // Set up periodic log updates
  const logInterval = setInterval(() => {
    if (adminNamespace) {
      adminNamespace.emit('system-logs', {
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'System heartbeat',
            category: 'system'
          }
        ],
        timestamp: new Date().toISOString()
      });
    }
  }, 10000); // Every 10 seconds

  // Clean up on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(statusInterval);
    clearInterval(logInterval);
    if (io) {
      io.close();
    }
  });

  console.log('✅ Socket.IO server initialized');
  return io;
}

/**
 * Get Socket.IO server instance
 * @returns {SocketIOServer|null} Socket.IO server instance or null
 */
function getSocketIO() {
  return io;
}

/**
 * Emit event to admin namespace
 * @param {string} event - Event name
 * @param {any} data - Event data
 */
function emitToAdmin(event, data) {
  if (io) {
    const adminNamespace = io.of('/admin');
    if (adminNamespace) {
      adminNamespace.emit(event, data);
    }
  }
}

module.exports = {
  initializeSocketIO,
  getSocketIO,
  emitToAdmin
};
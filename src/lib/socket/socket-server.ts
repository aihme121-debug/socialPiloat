import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { NextApiResponse } from 'next';

/**
 * Socket.IO server integration for Next.js
 * Provides real-time monitoring capabilities
 */

let io: SocketIOServer | undefined;

/**
 * Initialize Socket.IO server
 * @param httpServer - HTTP server instance
 * @returns Socket.IO server instance
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
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
    socket.emit('system-status', {
      status: 'connected',
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('❌ Admin dashboard disconnected:', socket.id, 'Reason:', reason);
    });

    // Handle client requests
    socket.on('get-system-status', () => {
      // This will be implemented to get actual system status
      socket.emit('system-status', {
        status: 'online',
        timestamp: new Date().toISOString()
      });
    });

    // Handle log requests
    socket.on('get-system-logs', () => {
      // This will be implemented to get recent logs
      socket.emit('system-logs', {
        logs: [],
        timestamp: new Date().toISOString()
      });
    });
  });

  // Set up periodic status updates
  const statusInterval = setInterval(() => {
    if (adminNamespace) {
      adminNamespace.emit('system-status', {
        status: 'online',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
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
 * @returns Socket.IO server instance or undefined
 */
export function getSocketIO(): SocketIOServer | undefined {
  return io;
}

/**
 * Emit event to admin namespace
 * @param event - Event name
 * @param data - Event data
 */
export function emitToAdmin(event: string, data: any): void {
  if (io) {
    const adminNamespace = io.of('/admin');
    if (adminNamespace) {
      adminNamespace.emit(event, data);
    }
  }
}

/**
 * Type for API responses with Socket.IO
 */
export interface SocketApiResponse extends Omit<NextApiResponse, 'socket'> {
  socket?: {
    server?: {
      io?: SocketIOServer;
    };
  } | null;
}
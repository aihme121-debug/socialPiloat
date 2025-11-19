import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { systemMonitor } from '@/lib/system/system-monitor-js';
import { NextApiResponse } from 'next';

// Type for HTTP server
import type { Server as HTTPServerType } from 'http';

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
export function initializeSocketIO(httpServer: HTTPServerType): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? (process.env.NEXT_PUBLIC_SITE_URL || '*')
        : ['http://localhost:3000', 'http://localhost:7070'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/socket.io',
    serveClient: true,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingInterval: 25000,
    pingTimeout: 60000,
    connectTimeout: 10000,
  });

  // Admin namespace for monitoring dashboard
  const adminNamespace = io.of('/admin');
  
  adminNamespace.on('connection', (socket) => {
    console.log('🔌 Admin dashboard connected:', socket.id);
    
    // Update system monitor with new connection
    systemMonitor.updateSocketServerStatus(true, adminNamespace.sockets.size);
    systemMonitor.addSocketConnection({ id: socket.id, userAgent: socket.handshake.headers['user-agent'], ip: socket.handshake.address });
    
    // Send initial system status
    socket.emit('system-status', {
      status: systemMonitor.getSystemStatus(),
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });

    // Send initial system logs
    socket.emit('system-logs', {
      logs: systemMonitor.getSystemLogs(),
      timestamp: new Date().toISOString()
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('❌ Admin dashboard disconnected:', socket.id, 'Reason:', reason);
      
      // Update system monitor with disconnection
      systemMonitor.removeSocketConnection(socket.id);
      systemMonitor.updateSocketServerStatus(true, adminNamespace.sockets.size);
    });

    // Handle client requests
    socket.on('get-system-status', () => {
      // Get actual system status from system monitor
      const status = systemMonitor.getSystemStatus();
      socket.emit('system-status', {
        status,
        timestamp: new Date().toISOString()
      });
    });

    // Handle log requests
    socket.on('get-system-logs', () => {
      // Get recent logs from system monitor
      const logs = systemMonitor.getSystemLogs();
      socket.emit('system-logs', {
        logs,
        timestamp: new Date().toISOString()
      });
    });
  });

  // Set up periodic status updates
  const statusInterval = setInterval(() => {
    if (adminNamespace) {
      const status = systemMonitor.getSystemStatus();
      adminNamespace.emit('system-status', {
        status,
        timestamp: new Date().toISOString()
      });
    }
  }, 5000); // Every 5 seconds

  // Set up periodic log updates
  const logInterval = setInterval(() => {
    if (adminNamespace) {
      const logs = systemMonitor.getSystemLogs({ limit: 50 });
      adminNamespace.emit('system-logs', {
        logs,
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
  (global as any).__socketIO = io;
  
  // Set up system monitor event broadcasting
  systemMonitor.on('new-log', (log: any) => {
    if (adminNamespace) {
      adminNamespace.emit('new-log', { log });
    }
  });
  
  systemMonitor.on('facebook-webhook', (data: any) => {
    if (adminNamespace) {
      adminNamespace.emit('facebook-webhook', data);
    }
    if (io) {
      io.emit('facebook-webhook', data);
    }
  });
  
  systemMonitor.on('facebook-api-connected', (data: any) => {
    if (adminNamespace) {
      adminNamespace.emit('facebook-api-connected', data);
    }
    if (io) {
      io.emit('facebook-api-connected', data);
    }
  });
  
  systemMonitor.on('facebook-api-error', (data: any) => {
    if (adminNamespace) {
      adminNamespace.emit('facebook-api-error', data);
    }
    if (io) {
      io.emit('facebook-api-error', data);
    }
  });
  
  systemMonitor.on('status-update', (data: any) => {
    if (adminNamespace) {
      adminNamespace.emit('system-status', { status: data });
    }
  });
  
  return io;
}

/**
 * Get Socket.IO server instance
 * @returns Socket.IO server instance or undefined
 */
export function getSocketIO(): SocketIOServer | undefined {
  return io || (global as any).__socketIO;
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
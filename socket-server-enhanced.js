const { Server } = require('socket.io');
const { systemMonitor } = require('./src/lib/system/system-monitor');

let io = null;
let connectionCount = 0;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Update socket server status
  systemMonitor.updateSocketServerStatus(true, 0);

  io.on('connection', (socket) => {
    connectionCount++;
    systemMonitor.updateSocketServerStatus(true, connectionCount);
    systemMonitor.addSocketConnection(socket.id);
    
    console.log('User connected:', socket.id);
    systemMonitor.logInfo('socket', 'New connection established', { 
      socketId: socket.id, 
      totalConnections: connectionCount 
    });

    socket.on('join-conversation', (conversationId) => {
      socket.join(conversationId);
      systemMonitor.updateSocketActivity(socket.id);
      console.log(`User ${socket.id} joined conversation ${conversationId}`);
      systemMonitor.logInfo('socket', 'User joined conversation', { 
        socketId: socket.id, 
        conversationId 
      });
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(conversationId);
      systemMonitor.updateSocketActivity(socket.id);
      console.log(`User ${socket.id} left conversation ${conversationId}`);
      systemMonitor.logInfo('socket', 'User left conversation', { 
        socketId: socket.id, 
        conversationId 
      });
    });

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
      systemMonitor.updateSocketActivity(socket.id);
      socket.to(conversationId).emit('user-typing', { userId, isTyping });
    });

    socket.on('message-read', ({ conversationId, messageId, userId }) => {
      systemMonitor.updateSocketActivity(socket.id);
      socket.to(conversationId).emit('message-read-status', { messageId, userId });
    });

    socket.on('disconnect', (reason) => {
      connectionCount--;
      systemMonitor.updateSocketServerStatus(true, connectionCount);
      systemMonitor.removeSocketConnection(socket.id, reason);
      
      console.log('User disconnected:', socket.id, 'Reason:', reason);
      systemMonitor.logInfo('socket', 'Connection closed', { 
        socketId: socket.id, 
        reason,
        totalConnections: connectionCount 
      });
    });

    socket.on('error', (error) => {
      systemMonitor.logError('socket', 'Socket error occurred', error, { 
        socketId: socket.id 
      });
    });
  });

  // Monitor socket server health
  setInterval(() => {
    if (io) {
      const sockets = Array.from(io.sockets.sockets.values());
      systemMonitor.logInfo('socket', 'Socket server health check', {
        totalConnections: sockets.length,
        activeConnections: sockets.filter(socket => socket.connected).length,
      });
    }
  }, 60000); // Every minute

  return io;
};

const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

const emitToConversation = (conversationId, event, data) => {
  if (io) {
    io.to(conversationId).emit(event, data);
    systemMonitor.logInfo('socket', 'Message emitted to conversation', { 
      conversationId, 
      event,
      dataType: typeof data 
    });
  }
};

const emitToUser = (userId, event, data) => {
  if (io) {
    io.emit(`user-${userId}`, { event, data });
    systemMonitor.logInfo('socket', 'Message emitted to user', { 
      userId, 
      event,
      dataType: typeof data 
    });
  }
};

// Handle socket server errors
process.on('uncaughtException', (error) => {
  systemMonitor.logError('socket', 'Uncaught exception in socket server', error);
});

process.on('unhandledRejection', (reason, promise) => {
  systemMonitor.logError('socket', 'Unhandled rejection in socket server', new Error(reason as string));
});

module.exports = {
  initializeSocket,
  getSocketIO,
  emitToConversation,
  emitToUser,
};
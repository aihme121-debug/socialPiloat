const { Server } = require('socket.io');
const { systemMonitor } = require('./dist/lib/system/system-monitor');

let io = null;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || ['http://localhost:3000', 'http://localhost:7070'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
    serveClient: true
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Update system monitor with new connection
    systemMonitor.updateSocketServerStatus(true, io.engine.clientsCount);
    systemMonitor.addSocketConnection({
      id: socket.id,
      userAgent: socket.handshake.headers['user-agent'],
      ip: socket.handshake.address
    });

    socket.on('join-conversation', (conversationId) => {
      socket.join(conversationId);
      console.log(`User ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.id} left conversation ${conversationId}`);
    });

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
      socket.to(conversationId).emit('user-typing', { userId, isTyping });
    });

    socket.on('message-read', ({ conversationId, messageId, userId }) => {
      socket.to(conversationId).emit('message-read-status', { messageId, userId });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Update system monitor with disconnection
      systemMonitor.removeSocketConnection(socket.id);
      systemMonitor.updateSocketServerStatus(true, io.engine.clientsCount);
    });
  });

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
  }
};

const emitToUser = (userId, event, data) => {
  if (io) {
    io.emit(`user-${userId}`, { event, data });
  }
};

module.exports = {
  initializeSocket,
  getSocketIO,
  emitToConversation,
  emitToUser,
};
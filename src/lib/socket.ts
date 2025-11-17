import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export const initializeSocket = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-conversation', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`User ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId: string) => {
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
    });
  });

  return io;
};

export const getSocketIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const emitToConversation = (conversationId: string, event: string, data: any) => {
  if (io) {
    io.to(conversationId).emit(event, data);
  }
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.emit(`user-${userId}`, { event, data });
  }
};
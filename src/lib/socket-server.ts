import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export const initializeSocketServer = (server: HTTPServer) => {
  if (io) return io;

  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
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

    socket.on('send-message', async (data) => {
      const { conversationId, content, senderId, timestamp } = data;
      
      // Emit the message to all users in the conversation except sender
      socket.to(conversationId).emit('new-message', {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conversationId,
        content,
        senderId,
        senderName: 'You',
        timestamp: new Date(timestamp),
        status: 'delivered',
        isRead: false
      });

      // Send confirmation back to sender
      socket.emit('message-sent', {
        conversationId,
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'sent'
      });
    });

    socket.on('message-delivered', ({ conversationId, messageId }) => {
      socket.to(conversationId).emit('message-delivered-status', { messageId });
    });

    socket.on('conversation-updated', ({ conversationId, updateType, data }) => {
      // Broadcast conversation updates to all users
      socket.to(conversationId).emit('conversation-update', {
        conversationId,
        updateType,
        data,
        timestamp: new Date()
      });
    });

    socket.on('mark-conversation-read', ({ conversationId, userId }) => {
      // Notify other users that conversation has been read
      socket.to(conversationId).emit('conversation-read', {
        conversationId,
        userId,
        timestamp: new Date()
      });
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
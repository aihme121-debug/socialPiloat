import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseSocketProps {
  conversationId?: string;
  userId?: string;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  markMessageAsRead: (conversationId: string, messageId: string) => void;
}

export const useSocket = ({ conversationId, userId }: UseSocketProps): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initializeSocket = async () => {
      try {
        setIsConnecting(true);

        const socketInstance = io('/admin', {
          transports: ['websocket', 'polling'],
          path: '/socket.io',
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketRef.current = socketInstance;

        socketInstance.on('connect', () => {
          setIsConnected(true);
          setIsConnecting(false);
          console.log('Socket connected:', socketInstance.id);
        });

        socketInstance.on('disconnect', () => {
          setIsConnected(false);
          console.log('Socket disconnected');
        });

        socketInstance.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setIsConnected(false);
          setIsConnecting(false);
        });
      } catch (error) {
        console.error('Failed to initialize socket:', error);
        setIsConnected(false);
        setIsConnecting(false);
      }
    };

    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('join-conversation', conversationId);
      
      return () => {
        socketRef.current?.emit('leave-conversation', conversationId);
      };
    }
  }, [conversationId]);

  const joinConversation = (convId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-conversation', convId);
    }
  };

  const leaveConversation = (convId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-conversation', convId);
    }
  };

  const sendTyping = (convId: string, isTyping: boolean) => {
    if (socketRef.current && userId) {
      socketRef.current.emit('typing', {
        conversationId: convId,
        userId,
        isTyping,
      });
    }
  };

  const markMessageAsRead = (convId: string, messageId: string) => {
    if (socketRef.current && userId) {
      socketRef.current.emit('message-read', {
        conversationId: convId,
        messageId,
        userId,
      });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    joinConversation,
    leaveConversation,
    sendTyping,
    markMessageAsRead,
  };
};
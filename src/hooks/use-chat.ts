import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { initializeSocket, getSocket, disconnectSocket, SOCKET_EVENTS } from '@/lib/socket';
import { 
  ChatConversation, 
  ChatMessage, 
  ChatFilter, 
  ChatTypingIndicator, 
  SendMessageData,
  ChatPresence 
} from '@/types/chat';
import { toast } from 'sonner';

interface UseChatReturn {
  conversations: ChatConversation[];
  messages: ChatMessage[];
  selectedConversation: ChatConversation | null;
  loading: boolean;
  sending: boolean;
  onlineUsers: ChatPresence[];
  typingIndicators: ChatTypingIndicator[];
  
  // Actions
  selectConversation: (conversation: ChatConversation) => void;
  sendMessage: (data: SendMessageData) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  loadMoreMessages: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  updateConversation: (conversationId: string, updates: Partial<ChatConversation>) => void;
  
  // Filters
  filters: ChatFilter;
  setFilters: (filters: ChatFilter) => void;
  
  // Pagination
  hasMoreMessages: boolean;
  hasMoreConversations: boolean;
}

export function useChat(businessId: string): UseChatReturn {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<ChatPresence[]>([]);
  const [typingIndicators, setTypingIndicators] = useState<ChatTypingIndicator[]>([]);
  const [filters, setFilters] = useState<ChatFilter>({});
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  
  const messagePageRef = useRef(1);
  const conversationPageRef = useRef(1);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    if (session?.accessToken) {
      initializeSocket(session.accessToken);
      setupSocketListeners();
    }

    return () => {
      disconnectSocket();
    };
  }, [session?.accessToken]);

  // Load conversations when businessId or filters change
  useEffect(() => {
    if (businessId) {
      loadConversations();
    }
  }, [businessId, filters]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id, true);
    }
  }, [selectedConversation?.id]);

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on(SOCKET_EVENTS.CONNECT, () => {
      console.log('Connected to chat server');
    });

    socket.on(SOCKET_EVENTS.MESSAGE_RECEIVED, (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      
      // Update conversation's last message
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === message.conversationId
            ? {
                ...conv,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                lastMessagePreview: message.content.substring(0, 100),
                unreadCount: conv.id === selectedConversation?.id ? conv.unreadCount : conv.unreadCount + 1,
              }
            : conv
        )
      );

      // Show notification if not in current conversation
      if (message.conversationId !== selectedConversation?.id) {
        toast.info(`New message from ${message.sender?.name || 'Customer'}`);
      }
    });

    socket.on(SOCKET_EVENTS.MESSAGE_READ, ({ conversationId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.conversationId === conversationId ? { ...msg, isRead: true } : msg
        )
      );
    });

    socket.on(SOCKET_EVENTS.MESSAGE_TYPING, (indicator: ChatTypingIndicator) => {
      setTypingIndicators((prev) => {
        const filtered = prev.filter((t) => t.conversationId !== indicator.conversationId);
        return indicator.isTyping ? [...filtered, indicator] : filtered;
      });
    });

    socket.on(SOCKET_EVENTS.USER_ONLINE, ({ userId, status }) => {
      setOnlineUsers((prev) => {
        const filtered = prev.filter((u) => u.userId !== userId);
        return status !== 'OFFLINE' ? [...filtered, { userId, status }] : filtered;
      });
    });

    socket.on(SOCKET_EVENTS.USER_OFFLINE, ({ userId, lastSeenAt }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
    });
  };

  const loadConversations = async (loadMore = false) => {
    if (loading && !loadMore) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId,
        page: loadMore ? (conversationPageRef.current + 1).toString() : '1',
        limit: '20',
      });

      // Add filter parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else if (typeof value === 'object') {
            if ('from' in value && 'to' in value) {
              params.append(`${key}From`, value.from.toISOString());
              params.append(`${key}To`, value.to.toISOString());
            }
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await fetch(`/api/chat/conversations?${params}`);
      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      const newConversations = data.conversations;

      if (loadMore) {
        setConversations((prev) => [...prev, ...newConversations]);
        conversationPageRef.current += 1;
      } else {
        setConversations(newConversations);
        conversationPageRef.current = 1;
      }

      setHasMoreConversations(newConversations.length === 20);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string, reset = false) => {
    if (loading && !reset) return;
    
    setLoading(true);
    try {
      const page = reset ? 1 : messagePageRef.current;
      const response = await fetch(
        `/api/chat/messages?conversationId=${conversationId}&page=${page}&limit=50`
      );
      
      if (!response.ok) throw new Error('Failed to load messages');

      const data = await response.json();
      const newMessages = data.messages;

      if (reset) {
        setMessages(newMessages);
        messagePageRef.current = 1;
      } else {
        setMessages((prev) => [...newMessages, ...prev]);
        messagePageRef.current += 1;
      }

      setHasMoreMessages(newMessages.length === 50);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = useCallback((conversation: ChatConversation) => {
    setSelectedConversation(conversation);
    // Mark conversation as read
    if (conversation.unreadCount > 0) {
      markAsRead(conversation.id);
    }
  }, []);

  const sendMessage = async (data: SendMessageData) => {
    if (!selectedConversation || sending) return;
    
    setSending(true);
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const message = await response.json();
      setMessages((prev) => [...prev, message]);
      
      // Update conversation's last message
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === data.conversationId
            ? {
                ...conv,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                lastMessagePreview: message.content.substring(0, 100),
              }
            : conv
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to mark as read');

      // Update local state
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const setTyping = (conversationId: string, isTyping: boolean) => {
    const socket = getSocket();
    if (!socket) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTyping) {
      socket.emit(SOCKET_EVENTS.MESSAGE_TYPING, {
        conversationId,
        userId: session?.user?.id,
        userName: session?.user?.name,
        isTyping: true,
      });

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit(SOCKET_EVENTS.MESSAGE_STOP_TYPING, {
          conversationId,
          userId: session?.user?.id,
          userName: session?.user?.name,
          isTyping: false,
        });
      }, 3000);
    } else {
      socket.emit(SOCKET_EVENTS.MESSAGE_STOP_TYPING, {
        conversationId,
        userId: session?.user?.id,
        userName: session?.user?.name,
        isTyping: false,
      });
    }
  };

  const loadMoreMessages = async () => {
    if (selectedConversation && hasMoreMessages) {
      await loadMessages(selectedConversation.id);
    }
  };

  const refreshConversations = async () => {
    conversationPageRef.current = 1;
    await loadConversations();
  };

  const updateConversation = (conversationId: string, updates: Partial<ChatConversation>) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, ...updates } : conv
      )
    );

    if (selectedConversation?.id === conversationId) {
      setSelectedConversation((prev) => prev ? { ...prev, ...updates } : null);
    }
  };

  return {
    conversations,
    messages,
    selectedConversation,
    loading,
    sending,
    onlineUsers,
    typingIndicators,
    
    // Actions
    selectConversation,
    sendMessage,
    markAsRead,
    setTyping,
    loadMoreMessages,
    refreshConversations,
    updateConversation,
    
    // Filters
    filters,
    setFilters,
    
    // Pagination
    hasMoreMessages,
    hasMoreConversations,
  };
}
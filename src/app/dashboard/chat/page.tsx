'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useBusiness } from '@/hooks/use-business';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { EnhancedChat } from '@/components/chat/EnhancedChat';
import { ConversationList } from '@/components/chat/ConversationList';
import { Card } from '@/components/ui/card';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isRead: boolean;
  mediaUrls?: string[];
  conversationId: string;
}

interface Conversation {
  id: string;
  platform: string;
  participantNames: string[];
  lastMessage?: {
    content: string;
    timestamp: Date;
    senderName: string;
  };
  unreadCount: number;
  isActive: boolean;
  avatar?: string;
}

function ChatInboxContent() {
  const { data: session } = useSession();
  const { selectedBusiness } = useBusiness();
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageStatuses, setMessageStatuses] = useState<Map<string, string>>(new Map());

  // Fetch conversations
  useEffect(() => {
    if (!selectedBusiness) return;

    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/facebook/conversations');
        if (!res.ok) {
          console.log('API failed, using mock conversations');
          const mockConversations: Conversation[] = [
            {
              id: 'mock_conversation_1',
              platform: 'FACEBOOK',
              participantNames: ['John Doe'],
              lastMessage: {
                content: 'Hello, I have a question about your services.',
                timestamp: new Date(Date.now() - 1000 * 60 * 30),
                senderName: 'John Doe'
              },
              unreadCount: 2,
              isActive: true,
            },
            {
              id: 'mock_conversation_2',
              platform: 'FACEBOOK',
              participantNames: ['Jane Smith'],
              lastMessage: {
                content: 'Thanks for your help!',
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
                senderName: 'Jane Smith'
              },
              unreadCount: 0,
              isActive: true,
            }
          ];
          setConversations(mockConversations);
          return;
        }
        
        const data = await res.json();
        const mappedConversations: Conversation[] = (data.conversations || []).map((conv: any) => ({
          id: conv.id,
          platform: conv.platform || 'FACEBOOK',
          participantNames: [conv.customer?.name || 'Unknown'],
          lastMessage: conv.lastMessagePreview ? {
            content: conv.lastMessagePreview,
            timestamp: new Date(conv.lastMessageAt || Date.now()),
            senderName: conv.customer?.name || 'Unknown'
          } : undefined,
          unreadCount: conv.unreadCount || 0,
          isActive: conv.status === 'OPEN',
          avatar: conv.customer?.avatar
        }));
        
        setConversations(mappedConversations);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        // Use mock data on error
        const mockConversations: Conversation[] = [
          {
            id: 'mock_conversation_1',
            platform: 'FACEBOOK',
            participantNames: ['John Doe'],
            lastMessage: {
              content: 'Hello, I have a question about your services.',
              timestamp: new Date(Date.now() - 1000 * 60 * 30),
              senderName: 'John Doe'
            },
            unreadCount: 2,
            isActive: true,
          },
          {
            id: 'mock_conversation_2',
            platform: 'FACEBOOK',
            participantNames: ['Jane Smith'],
            lastMessage: {
              content: 'Thanks for your help!',
              timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
              senderName: 'Jane Smith'
            },
            unreadCount: 0,
            isActive: true,
          }
        ];
        setConversations(mockConversations);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [selectedBusiness]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversationId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/facebook/conversations/${selectedConversationId}/messages`);
        if (!res.ok) {
          console.log('Messages API failed, using mock messages');
          const mockMessages: Message[] = [
            {
              id: 'mock_message_1',
              senderId: 'customer_1',
              senderName: 'John Doe',
              content: 'Hello, I have a question about your services.',
              timestamp: new Date(Date.now() - 1000 * 60 * 30),
              status: 'read',
              isRead: true,
              conversationId: selectedConversationId,
            },
            {
              id: 'mock_message_2',
              senderId: 'business_1',
              senderName: 'Your Business',
              content: 'Of course! I\'d be happy to help. What would you like to know?',
              timestamp: new Date(Date.now() - 1000 * 60 * 25),
              status: 'read',
              isRead: true,
              conversationId: selectedConversationId,
            },
            {
              id: 'mock_message_3',
              senderId: 'customer_1',
              senderName: 'John Doe',
              content: 'What are your pricing plans?',
              timestamp: new Date(Date.now() - 1000 * 60 * 20),
              status: 'read',
              isRead: true,
              conversationId: selectedConversationId,
            }
          ];
          setMessages(mockMessages);
          return;
        }
        
        const data = await res.json();
        const mappedMessages: Message[] = (data.messages || []).map((msg: any) => ({
          id: msg.id,
          senderId: msg.from?.id || 'unknown',
          senderName: msg.from?.name || 'Unknown',
          content: msg.message || msg.text || msg.snippet || '',
          timestamp: new Date(msg.created_time || Date.now()),
          status: 'read',
          isRead: true,
          conversationId: selectedConversationId,
          mediaUrls: msg.attachments?.map((att: any) => att.url) || []
        }));
        
        setMessages(mappedMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
        // Use mock data on error
        const mockMessages: Message[] = [
          {
            id: 'mock_message_1',
            senderId: 'customer_1',
            senderName: 'John Doe',
            content: 'Hello, I have a question about your services.',
            timestamp: new Date(Date.now() - 1000 * 60 * 30),
            status: 'read',
            isRead: true,
            conversationId: selectedConversationId,
          },
          {
            id: 'mock_message_2',
            senderId: 'business_1',
            senderName: 'Your Business',
            content: 'Of course! I\'d be happy to help. What would you like to know?',
            timestamp: new Date(Date.now() - 1000 * 60 * 25),
            status: 'read',
            isRead: true,
            conversationId: selectedConversationId,
          },
          {
            id: 'mock_message_3',
            senderId: 'customer_1',
            senderName: 'John Doe',
            content: 'What are your pricing plans?',
            timestamp: new Date(Date.now() - 1000 * 60 * 20),
            status: 'read',
            isRead: true,
            conversationId: selectedConversationId,
          }
        ];
        setMessages(mockMessages);
      }
    };

    fetchMessages();
  }, [selectedConversationId]);

  const handleSendMessage = useCallback(async (conversationId: string, content: string) => {
    try {
      // Create temporary message with 'sending' status
      const tempMessageId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: tempMessageId,
        senderId: session?.user?.id || 'current-user',
        senderName: 'You',
        content: content,
        timestamp: new Date(),
        status: 'sent',
        isRead: false,
        conversationId: conversationId
      };
      
      // Add temporary message to state
      setMessages(prev => [...prev, tempMessage]);
      
      const res = await fetch(`/api/facebook/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content })
      });
      
      if (res.ok) {
        // Update message status to 'sent'
        setMessageStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(tempMessageId, 'sent');
          return newMap;
        });
        
        // Refresh messages after sending
        const reload = await fetch(`/api/facebook/conversations/${conversationId}/messages`);
        if (reload.ok) {
          const data = await reload.json();
          const mappedMessages: Message[] = (data.messages || []).map((msg: any) => ({
            id: msg.id,
            senderId: msg.from?.id || 'unknown',
            senderName: msg.from?.name || 'Unknown',
            content: msg.message || msg.text || msg.snippet || '',
            timestamp: new Date(msg.created_time || Date.now()),
            status: 'read',
            isRead: true,
            conversationId: conversationId,
            mediaUrls: msg.attachments?.map((att: any) => att.url) || []
          }));
          setMessages(mappedMessages);
        }
      } else {
        // Update message status to 'failed'
        setMessageStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(tempMessageId, 'failed');
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Update message status to 'failed'
      setMessageStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(`temp-${Date.now()}`, 'failed');
        return newMap;
      });
    }
  }, [session?.user?.id]);

  const handleConversationSelect = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    
    // Mark conversation as read and reset unread count
    if (conversationId) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, unreadCount: 0 };
        }
        return conv;
      }));
      
      // Emit conversation read event
      window.dispatchEvent(new CustomEvent('conversation-read', { 
        detail: { conversationId, userId: session?.user?.id } 
      }));
    }
  }, [session?.user?.id]);

  // Handle real-time message updates
  useEffect(() => {
    const handleNewMessage = (event: CustomEvent) => {
      const newMessage = event.detail as Message;
      if (newMessage.conversationId === selectedConversationId) {
        setMessages(prev => [...prev, newMessage]);
        
        // Mark as delivered after a short delay
        setTimeout(() => {
          setMessageStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(newMessage.id, 'delivered');
            return newMap;
          });
        }, 500);
      }
      
      // Update conversation's last message and unread count
      setConversations(prev => prev.map(conv => {
        if (conv.id === newMessage.conversationId) {
          return {
            ...conv,
            lastMessage: {
              content: newMessage.content,
              timestamp: newMessage.timestamp,
              senderName: newMessage.senderName
            },
            unreadCount: conv.id === selectedConversationId ? 0 : conv.unreadCount + 1
          };
        }
        return conv;
      }));
    };

    const handleMessageStatusUpdate = (event: CustomEvent) => {
      const { messageId, status } = event.detail;
      setMessageStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(messageId, status);
        return newMap;
      });
    };

    const handleConversationUpdate = (event: CustomEvent) => {
      const { conversationId, updateType, data } = event.detail;
      
      if (updateType === 'unread_count_updated') {
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversationId) {
            return { ...conv, unreadCount: data.unreadCount };
          }
          return conv;
        }));
      }
    };

    window.addEventListener('new-message-received', handleNewMessage as EventListener);
    window.addEventListener('message-status-updated', handleMessageStatusUpdate as EventListener);
    window.addEventListener('conversation-update', handleConversationUpdate as EventListener);

    return () => {
      window.removeEventListener('new-message-received', handleNewMessage as EventListener);
      window.removeEventListener('message-status-updated', handleMessageStatusUpdate as EventListener);
      window.removeEventListener('conversation-update', handleConversationUpdate as EventListener);
    };
  }, [selectedConversationId]);

  if (!selectedBusiness) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Business Selected</h2>
          <p className="text-gray-500">Please select a business to view conversations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Conversations List */}
      <div className="w-96 bg-white border-r">
        <ConversationList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onConversationSelect={handleConversationSelect}
          loading={loading}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1">
        <EnhancedChat
          conversations={conversations}
          messages={messages}
          onSendMessage={handleSendMessage}
          onConversationSelect={handleConversationSelect}
          selectedConversationId={selectedConversationId}
          currentUserId={session?.user?.id || 'current-user'}
          messageStatuses={messageStatuses}
        />
      </div>
    </div>
  );
}

export default function ChatInboxPage() {
  return (
    <ProtectedRoute>
      <ChatInboxContent />
    </ProtectedRoute>
  );
}
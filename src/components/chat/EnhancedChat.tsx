'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { ConversationList } from '@/components/chat/ConversationList';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useSocket } from '@/hooks/useSocket';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Info } from 'lucide-react';

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

interface EnhancedChatProps {
  conversations: Conversation[];
  messages: Message[];
  onSendMessage: (conversationId: string, content: string) => void;
  onConversationSelect: (conversationId: string) => void;
  onTyping?: (conversationId: string, isTyping: boolean) => void;
  onMessageRead?: (messageId: string) => void;
  selectedConversationId?: string;
  loading?: boolean;
  currentUserId: string;
  messageStatuses?: Map<string, string>;
}

export function EnhancedChat({
  conversations,
  messages,
  onSendMessage,
  onConversationSelect,
  onTyping,
  onMessageRead,
  selectedConversationId,
  loading = false,
  currentUserId,
  messageStatuses,
}: EnhancedChatProps) {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const { socket, isConnected, joinConversation, leaveConversation, sendTyping } = useSocket({
    conversationId: selectedConversationId,
    userId: currentUserId,
  });

  // Handle real-time events
  useEffect(() => {
    if (!socket || !selectedConversationId) return;

    const handleNewMessage = (data: any) => {
      // Add new message to the messages array
      const newMessage: Message = {
        id: data.id,
        senderId: data.senderId,
        senderName: data.senderName,
        content: data.content,
        timestamp: new Date(data.timestamp),
        status: data.status || 'delivered',
        isRead: data.isRead || false,
        conversationId: data.conversationId,
        mediaUrls: data.mediaUrls || []
      };
      
      // Update messages state (this would need to be passed from parent)
      // For now, we'll emit an event that the parent can listen to
      window.dispatchEvent(new CustomEvent('new-message-received', { detail: newMessage }));
    };

    const handleUserTyping = ({ userId, isTyping }: { userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    };

    const handleMessageReadStatus = ({ messageId, userId }: { messageId: string; userId: string }) => {
      // Update message status to read
      window.dispatchEvent(new CustomEvent('message-status-updated', { 
        detail: { messageId, status: 'read', userId } 
      }));
    };

    const handleMessageSent = ({ conversationId, messageId, status }: { conversationId: string; messageId: string; status: string }) => {
      // Update message status to sent
      window.dispatchEvent(new CustomEvent('message-status-updated', { 
        detail: { messageId, status } 
      }));
    };

    const handleMessageDelivered = ({ messageId }: { messageId: string }) => {
      // Update message status to delivered
      window.dispatchEvent(new CustomEvent('message-status-updated', { 
        detail: { messageId, status: 'delivered' } 
      }));
    };

    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('message-read-status', handleMessageReadStatus);
    socket.on('message-sent', handleMessageSent);
    socket.on('message-delivered-status', handleMessageDelivered);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('message-read-status', handleMessageReadStatus);
      socket.off('message-sent', handleMessageSent);
      socket.off('message-delivered-status', handleMessageDelivered);
    };
  }, [socket, selectedConversationId]);

  // Join/leave conversation
  useEffect(() => {
    if (selectedConversationId) {
      joinConversation(selectedConversationId);
      return () => {
        leaveConversation(selectedConversationId);
      };
    }
  }, [selectedConversationId, joinConversation, leaveConversation]);

  const handleSendMessage = useCallback((content: string) => {
    if (selectedConversationId) {
      onSendMessage(selectedConversationId, content);
      
      // Send message via socket
      if (socket) {
        socket.emit('send-message', {
          conversationId: selectedConversationId,
          content,
          senderId: currentUserId,
          timestamp: new Date(),
        });
      }
    }
  }, [selectedConversationId, onSendMessage, socket, currentUserId]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (selectedConversationId) {
      sendTyping(selectedConversationId, isTyping);
      onTyping?.(selectedConversationId, isTyping);
    }
  }, [selectedConversationId, sendTyping, onTyping]);

  const handleMessageRead = useCallback((messageId: string) => {
    onMessageRead?.(messageId);
    
    if (socket && selectedConversationId) {
      socket.emit('message-read', {
        conversationId: selectedConversationId,
        messageId,
        userId: currentUserId,
      });
    }
  }, [onMessageRead, socket, selectedConversationId, currentUserId]);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const conversationMessages = messages.filter(m => m.conversationId === selectedConversationId);

  if (!selectedConversationId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Select a conversation</h3>
          <p className="text-gray-500">Choose a conversation from the list to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden hover:bg-gray-100"
            onClick={() => onConversationSelect('')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium text-lg shadow-sm">
                {selectedConversation?.participantNames[0]?.charAt(0).toUpperCase() || '?'}
              </div>
              {isConnected && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            
            <div>
              <h2 className="font-semibold text-gray-900 text-lg">
                {selectedConversation?.participantNames.join(', ')}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="capitalize font-medium">{selectedConversation?.platform}</span>
                {isConnected && (
                  <div className="flex items-center gap-1">
                    <span className="text-green-600">Active now</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" className="hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" className="hover:bg-gray-100">
            <Info className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gradient-to-b from-blue-50 to-white">
        {conversationMessages.map((message, index) => {
          const isCurrentUser = message.senderId === currentUserId;
          const showAvatar = index === 0 || conversationMessages[index - 1].senderId !== message.senderId;
          const isFirstInGroup = index === 0 || conversationMessages[index - 1].senderId !== message.senderId;
          const isLastInGroup = index === conversationMessages.length - 1 || 
            conversationMessages[index + 1].senderId !== message.senderId;
          
          // Update message status from messageStatuses map if available
          const updatedMessage = {
            ...message,
            status: (messageStatuses?.get(message.id) as Message['status']) || message.status
          };
          
          return (
            <div key={updatedMessage.id} className={`${isCurrentUser ? 'ml-auto' : 'mr-auto'} max-w-[70%]`}>
              <MessageBubble
                message={updatedMessage}
                isCurrentUser={isCurrentUser}
                onMessageRead={handleMessageRead}
                showAvatar={showAvatar && !isCurrentUser}
              />
            </div>
          );
        })}
        
        {typingUsers.size > 0 && (
          <div className="flex justify-start">
            <TypingIndicator 
              userName={typingUsers.size === 1 ? 
                conversations.find(c => c.id === selectedConversationId)?.participantNames[0] : 
                undefined
              }
              isMultiple={typingUsers.size > 1}
            />
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        disabled={!isConnected}
      />
    </div>
  );
}
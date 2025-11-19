'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useBusiness } from '@/hooks/use-business';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { EnhancedChat } from '@/components/chat/EnhancedChat';
import { ConversationList } from '@/components/chat/ConversationList';
import { Card } from '@/components/ui/card';
import { io } from 'socket.io-client';

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
  const [liveMessagesByConversation, setLiveMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [participantToConversation, setParticipantToConversation] = useState<Record<string, string>>({});
  const selectedConversationRef = useRef<string>('');
  const participantToConversationRef = useRef<Record<string, string>>({});

  // Fetch conversations
  useEffect(() => {
    if (!selectedBusiness) return;

    const fetchConversations = async () => {
      try {
        const liveRes = await fetch('/api/admin/facebook/messages?limit=50', { cache: 'no-store' });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          const msgs: any[] = Array.isArray(liveData.messages) ? liveData.messages : [];
          const byConv: Record<string, Message[]> = {};
          const mapPID: Record<string, string> = {};
          for (const m of msgs) {
            const convId = String(m.conversationId || '');
            if (!convId) continue;
            const mappedMsg: Message = {
              id: m.id,
              senderId: m.from?.id || 'unknown',
              senderName: m.from?.name || 'Unknown',
              content: m.message || '',
              timestamp: new Date(m.created_time || Date.now()),
              status: 'read',
              isRead: true,
              conversationId: convId,
              mediaUrls: []
            };
            if (!byConv[convId]) byConv[convId] = [];
            byConv[convId].push(mappedMsg);
            const participants = m.conversationParticipants?.data || [];
            for (const p of participants) {
              if (p?.id) mapPID[p.id] = convId;
            }
          }
          const convList: Conversation[] = Object.keys(byConv).map((cid) => {
            const msgsForConv = byConv[cid].slice().sort((a,b)=>b.timestamp.getTime()-a.timestamp.getTime());
            const latest = msgsForConv[0];
            const participants = (msgs.find(mm => String(mm.conversationId||'')===cid)?.conversationParticipants?.data) || [];
            const names = participants.map((p: any) => p.name).filter(Boolean);
            return {
              id: cid,
              platform: 'FACEBOOK',
              participantNames: names.length ? names : [latest?.senderName || 'Unknown'],
              lastMessage: latest ? { content: latest.content, timestamp: latest.timestamp, senderName: latest.senderName } : undefined,
              unreadCount: 0,
              isActive: true,
              avatar: undefined
            };
          });
          setLiveMessagesByConversation(byConv);
          setParticipantToConversation(mapPID);
          setConversations(convList);
        } else {
          const res = await fetch('/api/facebook/conversations/stored');
          if (!res.ok) {
            setConversations([]);
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
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [selectedBusiness]);

  useEffect(() => {
    selectedConversationRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    participantToConversationRef.current = participantToConversation;
  }, [participantToConversation]);

  useEffect(() => {
    if (!selectedBusiness) return;
    
    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const adminSocket = io(window.location.origin + '/admin', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('Chat socket connected:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Chat socket connection error:', error);
    });
    
    const handleWebhookRefresh = () => {
      if (selectedBusiness) {
        (async () => {
          try {
            const liveRes = await fetch('/api/admin/facebook/messages?limit=50', { cache: 'no-store' });
            if (liveRes.ok) {
              const liveData = await liveRes.json();
              const msgs: any[] = Array.isArray(liveData.messages) ? liveData.messages : [];
              const byConv: Record<string, Message[]> = {};
              const mapPID: Record<string, string> = {};
              for (const m of msgs) {
                const convId = String(m.conversationId || '');
                if (!convId) continue;
                const mappedMsg: Message = {
                  id: m.id,
                  senderId: m.from?.id || 'unknown',
                  senderName: m.from?.name || 'Unknown',
                  content: m.message || '',
                  timestamp: new Date(m.created_time || Date.now()),
                  status: 'read',
                  isRead: true,
                  conversationId: convId,
                  mediaUrls: []
                };
                if (!byConv[convId]) byConv[convId] = [];
                byConv[convId].push(mappedMsg);
                const participants = m.conversationParticipants?.data || [];
                for (const p of participants) {
                  if (p?.id) mapPID[p.id] = convId;
                }
              }
              const convList: Conversation[] = Object.keys(byConv).map((cid) => {
                const msgsForConv = byConv[cid].slice().sort((a,b)=>b.timestamp.getTime()-a.timestamp.getTime());
                const latest = msgsForConv[0];
                const participants = (msgs.find(mm => String(mm.conversationId||'')===cid)?.conversationParticipants?.data) || [];
                const names = participants.map((p: any) => p.name).filter(Boolean);
                return {
                  id: cid,
                  platform: 'FACEBOOK',
                  participantNames: names.length ? names : [latest?.senderName || 'Unknown'],
                  lastMessage: latest ? { content: latest.content, timestamp: latest.timestamp, senderName: latest.senderName } : undefined,
                  unreadCount: 0,
                  isActive: true,
                  avatar: undefined
                };
              });
              setLiveMessagesByConversation(byConv);
              setParticipantToConversation(mapPID);
              setConversations(convList);
            }
          } catch (error) {
            console.error('Error refreshing conversations:', error);
          }
        })();
      }
      if (selectedConversationId) {
        (async () => {
          try {
            const liveMsgs = liveMessagesByConversation[selectedConversationId] || [];
            if (liveMsgs.length) {
              setMessages(liveMsgs.slice().sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime()));
            }
          } catch (error) {
            console.error('Error refreshing messages:', error);
          }
        })();
      }
    };
    socket.on('facebook-webhook', handleWebhookRefresh);
    adminSocket.on('facebook-webhook', handleWebhookRefresh);

    const handleNewMessage = (data: any) => {
      const instantMsg: Message = {
        id: data?.id || `temp-${Date.now()}`,
        senderId: data?.senderId || 'unknown',
        senderName: data?.senderName || 'Unknown',
        content: data?.content || '',
        timestamp: new Date(data?.timestamp || Date.now()),
        status: 'delivered',
        isRead: false,
        conversationId: selectedConversationRef.current || participantToConversationRef.current[data?.senderId] || `temp-${data?.senderId || Date.now()}`,
        mediaUrls: []
      };

      let targetConversationId = selectedConversationRef.current || participantToConversationRef.current[data?.senderId];
      if (!targetConversationId) {
        const matched = conversations.find(c => (c.participantNames || []).includes(instantMsg.senderName));
        targetConversationId = matched?.id || `temp-${instantMsg.senderId}`;
      }

      if (targetConversationId) {
        setConversations(prev => {
          const exists = prev.some(c => c.id === targetConversationId);
          if (!exists) {
            const newConv: Conversation = {
              id: targetConversationId,
              platform: 'FACEBOOK',
              participantNames: [instantMsg.senderName],
              lastMessage: { content: instantMsg.content, timestamp: instantMsg.timestamp, senderName: instantMsg.senderName },
              unreadCount: selectedConversationId === targetConversationId ? 0 : 1,
              isActive: true,
              avatar: undefined
            };
            return [newConv, ...prev];
          }
          return prev.map(c => c.id === targetConversationId ? {
            ...c,
            lastMessage: { content: instantMsg.content, timestamp: instantMsg.timestamp, senderName: instantMsg.senderName },
            unreadCount: selectedConversationId === targetConversationId ? 0 : (c.unreadCount + 1)
          } : c);
        });

        if (selectedConversationRef.current === targetConversationId) {
          setMessages(prev => [...prev, { ...instantMsg, conversationId: targetConversationId! }]);
          setMessageStatuses(prev => {
            const map = new Map(prev);
            map.set(instantMsg.id, 'delivered');
            return map;
          });
        }
      }

      if (selectedBusiness) {
        (async () => {
          try {
            const liveRes = await fetch('/api/admin/facebook/messages?limit=50', { cache: 'no-store' });
            if (liveRes.ok) {
              const liveData = await liveRes.json();
              const msgs: any[] = Array.isArray(liveData.messages) ? liveData.messages : [];
              const byConv: Record<string, Message[]> = {};
              for (const m of msgs) {
                const convId = String(m.conversationId || '');
                if (!convId) continue;
                const mappedMsg: Message = {
                  id: m.id,
                  senderId: m.from?.id || 'unknown',
                  senderName: m.from?.name || 'Unknown',
                  content: m.message || '',
                  timestamp: new Date(m.created_time || Date.now()),
                  status: 'read',
                  isRead: true,
                  conversationId: convId,
                  mediaUrls: []
                };
                if (!byConv[convId]) byConv[convId] = [];
                byConv[convId].push(mappedMsg);
              }
              const convList: Conversation[] = Object.keys(byConv).map((cid) => {
                const msgsForConv = byConv[cid].slice().sort((a,b)=>b.timestamp.getTime()-a.timestamp.getTime());
                const latest = msgsForConv[0];
                const participants = (msgs.find(mm => String(mm.conversationId||'')===cid)?.conversationParticipants?.data) || [];
                const names = participants.map((p: any) => p.name).filter(Boolean);
                return {
                  id: cid,
                  platform: 'FACEBOOK',
                  participantNames: names.length ? names : [latest?.senderName || 'Unknown'],
                  lastMessage: latest ? { content: latest.content, timestamp: latest.timestamp, senderName: latest.senderName } : undefined,
                  unreadCount: 0,
                  isActive: true,
                  avatar: undefined
                };
              });
              setLiveMessagesByConversation(byConv);
              setConversations(convList);
              if (selectedConversationId && byConv[selectedConversationId]) {
                const liveMsgs = byConv[selectedConversationId];
                setMessages(liveMsgs.slice().sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime()));
              }
            }
          } catch (error) {
            console.error('Error refreshing conversations:', error);
          }
        })();
      }
    };
    socket.on('new-message', handleNewMessage);
    adminSocket.on('new-message', handleNewMessage);
    
    return () => { 
      if (socket.connected) {
        socket.disconnect(); 
      }
      if (adminSocket.connected) {
        adminSocket.disconnect();
      }
    };
  }, [selectedBusiness, selectedConversationId]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversationId) return;

    const fetchMessages = async () => {
      try {
        const liveMsgs = liveMessagesByConversation[selectedConversationId];
        if (liveMsgs && liveMsgs.length) {
          setMessages(liveMsgs.slice().sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime()));
          return;
        }
        const res = await fetch(`/api/facebook/conversations/${selectedConversationId}/messages/stored`);
        if (!res.ok) {
          setMessages([]);
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
        setMessages([]);
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
      
      const res = await fetch(`/api/facebook/conversations/${conversationId}/messages/stored`, {
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
        const reload = await fetch(`/api/facebook/conversations/${conversationId}/messages/stored`);
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
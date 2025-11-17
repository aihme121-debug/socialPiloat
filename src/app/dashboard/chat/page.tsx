'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useBusiness } from '@/hooks/use-business';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';

function ChatInboxContent() {
  const { data: session } = useSession();
  const { selectedBusiness } = useBusiness();
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageInput, setMessageInput] = useState('');

  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/facebook/conversations');
        if (!res.ok) return;
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch {}
    })();
  }, []);

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
      <div className="w-96 bg-white/60 backdrop-blur-xl border-r border-white/20">
        <div className="p-4 border-b border-white/20">
          <h1 className="text-xl font-semibold text-gray-800 mb-4">Inbox</h1>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/30 rounded-lg focus:bg-white/80 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`mb-2 p-3 cursor-pointer transition-all duration-200 hover:shadow-md rounded-lg border ${
                  selectedConversation?.id === conversation.id
                    ? "bg-blue-50/80 border-blue-200 shadow-md"
                    : "bg-white/50 hover:bg-white/70 border-white/30"
                } ${conversation.unreadCount > 0 ? "border-l-4 border-l-blue-500" : ""}`}
                    onClick={async () => {
                      setSelectedConversation(conversation);
                      try {
                        const res = await fetch(`/api/facebook/conversations/${conversation.id}/messages`);
                        if (!res.ok) return;
                        const data = await res.json();
                        setMessages(data.messages || []);
                      } catch {}
                    }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {conversation.customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-gray-800 truncate">
                          {conversation.customer.name}
                        </h3>
                        <div className="flex items-center gap-1">
                          {conversation.status === 'OPEN' && <div className="w-3 h-3 bg-green-500 rounded-full"></div>}
                          {conversation.status === 'PENDING' && <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>}
                          {conversation.platform === 'FACEBOOK' && <span className="text-blue-600">f</span>}
                          {conversation.platform === 'WHATSAPP' && <span className="text-green-600">W</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {conversation.priority !== 'MEDIUM' && (
                          <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                            {conversation.priority}
                          </span>
                        )}
                        {conversation.unreadCount > 0 && (
                          <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {conversation.subject && (
                      <p className="text-xs text-gray-600 mb-1">{conversation.subject}</p>
                    )}
                    
                    {conversation.lastMessagePreview && (
                      <p className="text-xs text-gray-500 truncate">
                        {conversation.lastMessagePreview}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400"></div>
                      {conversation.lastMessageAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(conversation.lastMessageAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white/60 backdrop-blur-xl border-b border-white/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {selectedConversation.customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  
                  <div>
                    <h2 className="font-semibold text-gray-800">
                      {selectedConversation.customer.name}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {selectedConversation.platform === 'FACEBOOK' && <span className="text-blue-600">f</span>}
                      {selectedConversation.platform === 'WHATSAPP' && <span className="text-green-600">W</span>}
                      <span>{selectedConversation.platform}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((m, idx) => (
                  <div key={idx} className={"flex " + (m.from?.id ? 'justify-start' : 'justify-end')}>
                    <div className={(m.from?.id ? 'bg-white text-gray-800 border border-gray-200' : 'bg-blue-500 text-white') + " rounded-lg px-4 py-2 max-w-md"}>
                      <p className="text-sm">{m.message || m.text || m.snippet || ''}</p>
                      {m.created_time && (
                        <div className={(m.from?.id ? 'text-gray-400' : 'opacity-70') + " text-xs mt-1"}>
                          {new Date(m.created_time).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="bg-white/60 backdrop-blur-xl border-t border-white/20 p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <textarea
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        setMessageInput('');
                      }
                    }}
                    rows={1}
                    className="w-full pl-3 pr-4 py-2 bg-white/50 border border-white/30 rounded-lg focus:bg-white/80 resize-none outline-none"
                  />
                </div>
                
                <button
                  disabled={!messageInput.trim()}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    const text = messageInput.trim();
                    if (!text || !selectedConversation) return;
                    try {
                      const res = await fetch(`/api/facebook/conversations/${selectedConversation.id}/messages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                      });
                      if (res.ok) {
                        setMessageInput('');
                        const reload = await fetch(`/api/facebook/conversations/${selectedConversation.id}/messages`);
                        if (reload.ok) {
                          const data = await reload.json();
                          setMessages(data.messages || []);
                        }
                      }
                    } catch {}
                  }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-white/50 backdrop-blur-lg rounded-full flex items-center justify-center">
                <svg className="h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Select a Conversation</h2>
              <p className="text-gray-600">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
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
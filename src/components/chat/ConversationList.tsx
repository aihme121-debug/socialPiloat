import { useState, useEffect } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

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

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  onConversationSelect: (conversationId: string) => void;
  onConversationSearch?: (query: string) => void;
  loading?: boolean;
}

export function ConversationList({ 
  conversations, 
  selectedConversationId, 
  onConversationSelect, 
  onConversationSearch,
  loading = false 
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(conversation =>
    conversation.participantNames.some(name =>
      name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || conversation.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onConversationSearch?.(query);
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
        return 'bg-blue-500';
      case 'instagram':
        return 'bg-gradient-to-br from-purple-500 to-pink-500';
      case 'twitter':
        return 'bg-sky-500';
      case 'linkedin':
        return 'bg-blue-700';
      default:
        return 'bg-gray-500';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm">{searchQuery ? 'No conversations found' : 'No conversations available'}</p>
            <p className="text-xs text-gray-400 mt-1">Start a new conversation to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onConversationSelect(conversation.id)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-all duration-200 ${
                  selectedConversationId === conversation.id 
                    ? 'bg-blue-50 border-r-2 border-blue-500 shadow-sm' 
                    : 'hover:shadow-sm'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar with online status */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 ${getPlatformColor(conversation.platform)} rounded-full flex items-center justify-center text-white font-medium text-lg shadow-sm`}>
                      {conversation.avatar ? (
                        <img src={conversation.avatar} alt={conversation.participantNames[0]} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitials(conversation.participantNames[0] || conversation.platform)
                      )}
                    </div>
                    
                    {/* Online status indicator */}
                    {conversation.isActive && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                    )}
                    
                    {/* Platform indicator */}
                    <div className={`absolute -top-1 -right-1 w-5 h-5 ${getPlatformColor(conversation.platform)} rounded-full border-2 border-white flex items-center justify-center shadow-sm`}>
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>

                  {/* Conversation Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-semibold truncate ${
                        conversation.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {conversation.participantNames.join(', ')}
                      </h3>
                      
                      {conversation.lastMessage && (
                        <span className={`text-xs ${
                          conversation.unreadCount > 0 ? 'text-blue-600 font-medium' : 'text-gray-500'
                        }`}>
                          {formatDistanceToNow(conversation.lastMessage.timestamp, { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-sm truncate max-w-[200px] ${
                        conversation.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'
                      }`}>
                        {conversation.lastMessage?.content || 'No messages yet'}
                      </p>
                      
                      {conversation.unreadCount > 0 && (
                        <Badge className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center">
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center mt-1">
                      <span className={`text-xs capitalize font-medium ${
                        conversation.unreadCount > 0 ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {conversation.platform}
                      </span>
                      
                      {conversation.isActive && (
                        <span className="ml-2 text-xs text-green-600 font-medium">● Active</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
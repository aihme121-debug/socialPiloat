import { format, formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';
import { MessageStatus } from './MessageStatus';
import { useState, useEffect } from 'react';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isRead: boolean;
  mediaUrls?: string[];
  avatar?: string;
  isEdited?: boolean;
  reactions?: { emoji: string; users: string[] }[];
}

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  onMessageRead?: (messageId: string) => void;
  showAvatar?: boolean;
  onReact?: (messageId: string, emoji: string) => void;
}

export function MessageBubble({ 
  message, 
  isCurrentUser, 
  onMessageRead, 
  showAvatar = true,
  onReact
}: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, 'h:mm a');
    } else if (diffInHours < 48) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  const formatTimeAgo = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  return (
    <div 
      className={`flex items-end gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'} group`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isCurrentUser && showAvatar && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {message.senderName.charAt(0).toUpperCase()}
          </div>
        </Avatar>
      )}
      
      <div className={`max-w-[70%] ${isCurrentUser ? 'order-1' : ''}`}>
        <div className={`rounded-2xl px-4 py-2 shadow-sm ${
          isCurrentUser 
            ? 'bg-blue-500 text-white ml-auto' 
            : 'bg-white text-gray-900 border border-gray-200'
        }`}>
          <div className="text-sm leading-relaxed">
            {message.content}
          </div>
          
          {message.mediaUrls && message.mediaUrls.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.mediaUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt="Shared media"
                    className="rounded-xl max-w-full h-auto cursor-pointer hover:opacity-90 transition-all duration-200"
                    onClick={() => window.open(url, '_blank')}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 rounded-xl transition-all duration-200" />
                </div>
              ))}
            </div>
          )}
          
          <div className={`flex items-center justify-end mt-1 text-xs ${
            isCurrentUser ? 'text-blue-100' : 'text-gray-500'
          }`}>
            <span className="mr-1">{formatMessageTime(message.timestamp)}</span>
            {isCurrentUser && <MessageStatus status={message.status} size={12} />}
            {message.isEdited && <span className="ml-1 text-xs opacity-70">(edited)</span>}
          </div>
        </div>
        
        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((reaction, index) => (
              <button
                key={index}
                className="bg-white rounded-full px-2 py-1 text-xs shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                onClick={() => onReact?.(message.id, reaction.emoji)}
              >
                {reaction.emoji} {reaction.users.length > 1 && reaction.users.length}
              </button>
            ))}
          </div>
        )}
        
        {/* Hover actions */}
        {isHovered && (
          <div className={`flex gap-1 mt-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
            <button
              className="bg-white rounded-full p-1 shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
              onClick={() => setShowReactions(!showReactions)}
            >
              😊
            </button>
            <button className="bg-white rounded-full p-1 shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors">
              ➕
            </button>
          </div>
        )}
        
        {/* Reaction picker */}
        {showReactions && (
          <div className="flex gap-1 mt-1 p-2 bg-white rounded-lg shadow-lg border border-gray-200">
            {reactions.map(emoji => (
              <button
                key={emoji}
                className="hover:bg-gray-100 rounded p-1 transition-colors"
                onClick={() => {
                  onReact?.(message.id, emoji);
                  setShowReactions(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        
        <div className={`text-xs text-gray-500 mt-1 ${
          isCurrentUser ? 'text-right' : 'text-left'
        }`}>
          {!isCurrentUser && (
            <span className="font-medium">{message.senderName}</span>
          )}
          {message.status === 'read' && isCurrentUser && (
            <span className="text-blue-500 ml-1">Read</span>
          )}
        </div>
      </div>
      
      {isCurrentUser && showAvatar && (
        <Avatar className="w-8 h-8 order-2 flex-shrink-0">
          <div className="w-full h-full bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            You
          </div>
        </Avatar>
      )}
    </div>
  );
}
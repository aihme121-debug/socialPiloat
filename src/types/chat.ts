export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'USER' | 'CUSTOMER' | 'AI';
  content: string;
  contentType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'LOCATION' | 'TEMPLATE';
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'WEB_CHAT' | 'EMAIL';
  externalMessageId?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  sender?: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  attachments?: ChatAttachment[];
}

export interface ChatConversation {
  id: string;
  businessId: string;
  customerId: string;
  assignedToId?: string;
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'WEB_CHAT' | 'EMAIL';
  externalConversationId?: string;
  externalPageId?: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subject?: string;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  unreadCount: number;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  customer: ChatCustomer;
  assignedTo?: ChatUser;
  lastMessage?: ChatMessage;
  messages?: ChatMessage[];
  tagsData?: ChatTag[];
}

export interface ChatCustomer {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'WEB_CHAT' | 'EMAIL';
  externalCustomerId?: string;
  externalPageId?: string;
  profileData?: Record<string, any>;
  lastSeenAt?: Date;
  isOnline: boolean;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  conversations?: ChatConversation[];
  tagsData?: ChatTag[];
}

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  isOnline: boolean;
  lastSeenAt?: Date;
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ChatTag {
  id: string;
  businessId: string;
  name: string;
  color: string;
  description?: string;
  createdAt: Date;
}

export interface ChatFilter {
  status?: ('OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'ARCHIVED')[];
  platform?: ('FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'WEB_CHAT' | 'EMAIL')[];
  priority?: ('LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')[];
  assignedToId?: string;
  tags?: string[];
  search?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface ChatTypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface SendMessageData {
  conversationId: string;
  content: string;
  contentType?: ChatMessage['contentType'];
  attachments?: File[];
  metadata?: Record<string, any>;
}

export interface ChatPresence {
  userId: string;
  conversationId?: string;
  status: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
  lastSeenAt?: Date;
  isTyping?: boolean;
  currentConversationId?: string;
}

// Socket.io event types
export interface SocketEvents {
  'message:sent': ChatMessage;
  'message:received': ChatMessage;
  'message:read': { messageId: string; conversationId: string; readAt: Date };
  'message:typing': ChatTypingIndicator;
  'message:stop_typing': ChatTypingIndicator;
  'conversation:created': ChatConversation;
  'conversation:updated': ChatConversation;
  'conversation:assigned': { conversationId: string; assignedToId: string; assignedById: string };
  'user:online': { userId: string; status: 'ONLINE' | 'AWAY' | 'BUSY' };
  'user:offline': { userId: string; lastSeenAt: Date };
  'notification:new_message': { conversationId: string; message: ChatMessage; unreadCount: number };
}
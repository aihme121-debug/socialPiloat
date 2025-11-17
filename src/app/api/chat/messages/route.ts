import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { ChatMessage, SendMessageData } from '@/types/chat';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@/lib/socket';
import { SocialPlatform } from '@prisma/client';

// GET /api/chat/messages - Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with tenant information
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, tenantId: true, businessId: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    // Parse conversation ID to get customer and platform
    const [customerId, platform] = conversationId.split('_');
    
    if (!customerId || !platform) {
      return NextResponse.json({ error: 'Invalid conversation ID format' }, { status: 400 });
    }

    // Check if user has access to this business and customer
    if (!user.businessId) {
      return NextResponse.json({ error: 'User has no business' }, { status: 400 });
    }

    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        businessId: user.businessId,
        business: {
          tenantId: user.tenantId,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
    }

    const [messages, total] = await Promise.all([
      db.chatMessage.findMany({
        where: { 
          customerId,
          platform: platform as SocialPlatform,
          businessId: user.businessId
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      db.chatMessage.count({ 
        where: { 
          customerId,
          platform: platform as SocialPlatform,
          businessId: user.businessId
        }
      }),
    ]);

    // Mark messages as read if they're from the customer (senderId matches customerId)
    const unreadMessages = messages.filter(
      (msg) => !msg.isRead && msg.senderId === customerId
    );

    if (unreadMessages.length > 0) {
      await db.chatMessage.updateMany({
        where: {
          id: { in: unreadMessages.map((msg) => msg.id) },
        },
        data: {
          isRead: true,
        },
      });
    }

    // Map messages to include sender information
    const mappedMessages = messages.map(msg => ({
      ...msg,
      sender: msg.user
    }));

    return NextResponse.json({
      messages: mappedMessages.reverse(), // Reverse to show oldest first
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/messages - Send a message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with tenant information
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, tenantId: true, businessId: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body: SendMessageData = await request.json();
    const { conversationId, content, contentType = 'TEXT', attachments, metadata } = body;

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Parse conversation ID to get customer and platform
    const [customerId, platform] = conversationId.split('_');
    
    if (!customerId || !platform) {
      return NextResponse.json({ error: 'Invalid conversation ID format' }, { status: 400 });
    }

    // Check if user has access to this business and customer
    if (!user.businessId) {
      return NextResponse.json({ error: 'User has no business' }, { status: 400 });
    }

    const customer = await db.customer.findFirst({
      where: {
        id: customerId,
        businessId: user.businessId,
        business: {
          tenantId: user.tenantId,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
    }

    // Generate message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create message
    const message = await db.chatMessage.create({
      data: {
        messageId,
        senderId: user.id,
        senderName: user.name,
        content,
        platform: platform as SocialPlatform,
        businessId: user.businessId,
        customerId,
        isRead: false,
        userId: user.id,
        accountId: 'manual', // Default account ID
        mediaUrls: [],
        timestamp: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Map message to include sender information
    const mappedMessage = {
      ...message,
      sender: message.user
    };

    // Emit socket events for real-time updates
    const socket = getSocket();
    if (socket) {
      socket.emit(SOCKET_EVENTS.MESSAGE_SENT, mappedMessage);
      socket.emit(SOCKET_EVENTS.NOTIFICATION_NEW_MESSAGE, {
        conversationId,
        message: mappedMessage,
        unreadCount: 1,
      });
    }

    return NextResponse.json(mappedMessage, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ChatMessage, ChatFilter } from '@/types/chat';

// GET /api/chat/conversations - Get conversations with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with tenant information
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, tenantId: true, businessId: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    // Check if user has access to this business
    const businessAccess = await prisma.business.findFirst({
      where: {
        id: businessId,
        tenantId: user.tenantId,
      },
    });

    if (!businessAccess || user.businessId !== businessId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build filter conditions for chat messages
    const where: any = {
      businessId,
    };

    // Apply filters from search params
    if (searchParams.get('platform')) {
      where.platform = { in: searchParams.get('platform')?.split(',') };
    }

    if (searchParams.get('search')) {
      where.content = { contains: searchParams.get('search'), mode: 'insensitive' };
    }

    // Get recent messages and group them by conversation
    const messages = await prisma.chatMessage.findMany({
      where,
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
      take: limit * 10, // Get more messages to ensure we get diverse conversations
    });

    // Group messages by conversation and create conversation objects
    const conversationsMap = new Map();
    
    messages.forEach((message: any) => {
      // Create conversation ID based on customer and platform
      const conversationId = `${message.customerId}_${message.platform}`;
      
      if (!conversationsMap.has(conversationId)) {
        conversationsMap.set(conversationId, {
          id: conversationId,
          businessId,
          customerId: message.customerId,
          platform: message.platform,
          status: 'OPEN', // Default status
          priority: 'MEDIUM', // Default priority
          lastMessageAt: message.createdAt,
          lastMessagePreview: message.content.substring(0, 100),
          unreadCount: message.isRead ? 0 : 1,
          tags: [],
          createdAt: message.createdAt,
          updatedAt: message.createdAt, // Use createdAt since there's no updatedAt
          messages: [],
          lastMessage: {
            ...message,
            sender: message.user // Map user to sender for consistency
          },
        });
      }
      
      const conversation = conversationsMap.get(conversationId);
      conversation.messages.push(message);
      
      if (!message.isRead) {
        conversation.unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values())
      .slice(skip, skip + limit);

    return NextResponse.json({
      conversations,
      pagination: {
        page,
        limit,
        total: conversationsMap.size,
        pages: Math.ceil(conversationsMap.size / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat/conversations - Create new conversation (represented as first message)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with tenant information
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, tenantId: true, businessId: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { businessId, customerId, platform, content } = body;

    if (!businessId || !customerId || !platform || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user has access to this business
    const businessAccess = await prisma.business.findFirst({
      where: {
        id: businessId,
        tenantId: user.tenantId,
      },
    });

    if (!businessAccess || user.businessId !== businessId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if customer exists and belongs to this business
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Generate message ID
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create the first message in the conversation
    const message = await prisma.chatMessage.create({
      data: {
        messageId,
        senderId: user.id,
        senderName: user.name,
        content,
        platform,
        businessId,
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

    // Return conversation-like structure
    const conversationId = `${customerId}_${platform}`;
    const conversation = {
      id: conversationId,
      businessId,
      customerId,
      platform,
      status: 'OPEN',
      priority: 'MEDIUM',
      lastMessageAt: message.createdAt,
      lastMessagePreview: content.substring(0, 100),
      unreadCount: 1,
      tags: [],
      createdAt: message.createdAt,
      updatedAt: message.createdAt, // Use createdAt since there's no updatedAt
      messages: [{
        ...message,
        sender: message.user // Map user to sender for consistency
      }],
      lastMessage: {
        ...message,
        sender: message.user // Map user to sender for consistency
      },
      customer,
    };

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
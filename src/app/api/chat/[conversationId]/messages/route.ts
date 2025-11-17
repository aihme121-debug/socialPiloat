import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emitToConversation } from '@/lib/socket';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = params;
    const { message, status = 'sent' } = await request.json();

    if (!message || !conversationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create new message in database
    const newMessage = await prisma.chatMessage.create({
      data: {
        platform: 'FACEBOOK',
        accountId: conversationId,
        messageId: `msg_${Date.now()}`,
        senderId: session.user.id,
        senderName: session.user.name || 'Unknown',
        content: message,
        timestamp: new Date(),
        status,
        conversationId,
        businessId: session.user.businessId || 'default',
        userId: session.user.id,
      },
    });

    // Emit real-time event to conversation participants
    try {
      emitToConversation(conversationId, 'new-message', {
        message: {
          id: newMessage.id,
          senderId: newMessage.senderId,
          senderName: newMessage.senderName,
          content: newMessage.content,
          timestamp: newMessage.timestamp,
          status: newMessage.status,
          conversationId: newMessage.conversationId,
        },
      });
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
      // Continue with the response even if socket emission fails
    }

    return NextResponse.json({ 
      success: true, 
      message: newMessage,
      status: 'sent'
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

// Update message status (delivered, read, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId } = params;
    const { messageId, status } = await request.json();

    if (!messageId || !status || !conversationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Update message status
    const updatedMessage = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        status,
        ...(status === 'delivered' && { deliveredAt: new Date() }),
        ...(status === 'read' && { readAt: new Date(), isRead: true }),
      },
    });

    // Emit status update to conversation
    try {
      emitToConversation(conversationId, 'message-status-update', {
        messageId: updatedMessage.id,
        status: updatedMessage.status,
        deliveredAt: updatedMessage.deliveredAt,
        readAt: updatedMessage.readAt,
      });
    } catch (socketError) {
      console.error('Socket emission error:', socketError);
    }

    return NextResponse.json({ 
      success: true, 
      message: updatedMessage 
    });

  } catch (error) {
    console.error('Error updating message status:', error);
    return NextResponse.json(
      { error: 'Failed to update message status' },
      { status: 500 }
    );
  }
}
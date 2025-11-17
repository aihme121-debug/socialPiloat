import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId, message, postId } = await request.json();

    if (!commentId || !message || !postId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    // Get Facebook social account
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        businessId: user.business.id,
        platform: 'FACEBOOK'
      }
    });

    if (!socialAccount?.accessToken) {
      return NextResponse.json({ error: 'No Facebook account with valid access token' }, { status: 404 });
    }

    // Reply to the comment
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${commentId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          access_token: socialAccount.accessToken
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Facebook API error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to reply to comment', 
        details: errorData.error?.message || 'Unknown error' 
      }, { status: response.status });
    }

    const replyData = await response.json();

    // Log the reply in our database
    await prisma.chatMessage.create({
      data: {
        accountId: postId,
        messageId: replyData.id,
        platform: 'FACEBOOK',
        content: message,
        senderName: socialAccount.accountName,
        senderId: socialAccount.accountId,
        isReplied: true,
        timestamp: new Date(),
        businessId: user.business.id
      }
    });

    return NextResponse.json({
      success: true,
      reply: {
        id: replyData.id,
        message: message,
        createdTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error replying to comment:', error);
    return NextResponse.json({ error: 'Failed to reply to comment' }, { status: 500 });
  }
}
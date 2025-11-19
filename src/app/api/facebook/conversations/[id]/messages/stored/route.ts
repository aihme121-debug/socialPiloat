import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { business: true }
    })

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 })
    }

    // 🔄 NEW APPROACH: Use stored messages instead of Facebook API
    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId: params.id,
        businessId: user.business.id
      },
      orderBy: { timestamp: 'asc' }
    })

    // Format messages for the frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      message: msg.content,
      from: {
        id: msg.senderId,
        name: msg.senderName
      },
      created_time: msg.timestamp.toISOString(),
      snippet: msg.content.substring(0, 50),
      attachments: msg.mediaUrls?.map(url => ({ url })) || []
    }))

    return NextResponse.json({ messages: formattedMessages })

  } catch (err) {
    console.error('Facebook messages error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await request.json()
    const { message } = body
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { business: true }
    })

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 })
    }

    // Get Facebook social account
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        businessId: user.business.id,
        platform: 'FACEBOOK',
        isActive: true
      }
    })

    if (!socialAccount?.accessToken) {
      return NextResponse.json({ error: 'No Facebook account with valid access token' }, { status: 404 })
    }

    // Send message via Facebook API
    const sendUrl = `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(socialAccount.accessToken)}`
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { thread_key: params.id },
        message: { text: message }
      })
    })

    const data = await response.json()
    if (!response.ok || data.error) {
      return NextResponse.json({ error: data?.error?.message || 'Failed to send message' }, { status: 400 })
    }

    // Store the sent message in database
    await prisma.chatMessage.create({
      data: {
        platform: 'FACEBOOK',
        accountId: socialAccount.accountId,
        messageId: data.message_id,
        senderId: session.user.id,
        senderName: 'You',
        content: message,
        timestamp: new Date(),
        businessId: user.business.id,
        conversationId: params.id,
        isRead: true,
        isReplied: false
      }
    })

    return NextResponse.json({ success: true, messageId: data.message_id })

  } catch (err) {
    console.error('Facebook send message error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
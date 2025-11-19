import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    })

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 })
    }

    // Get Facebook social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        businessId: user.business.id,
        platform: 'FACEBOOK'
      }
    })

    if (socialAccounts.length === 0) {
      return NextResponse.json({ error: 'No Facebook accounts found' }, { status: 404 })
    }

    const account = pageId 
      ? socialAccounts.find(acc => acc.accountId === pageId)
      : socialAccounts[0]

    if (!account?.accessToken) {
      return NextResponse.json({ error: 'No Facebook account with valid access token' }, { status: 404 })
    }

    // 🔄 NEW APPROACH: Use stored conversations instead of Facebook API
    // This avoids permission issues and provides real-time data
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId: user.business.id,
        platform: 'FACEBOOK',
        accountId: account.accountId,
        isActive: true
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    })

    // Format conversations for the frontend
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      platform: 'FACEBOOK',
      customer: {
        id: conv.participantIds[0] || 'unknown',
        name: conv.participantNames[0] || 'Unknown User'
      },
      lastMessagePreview: conv.messages[0]?.content?.substring(0, 100) || 'No messages',
      lastMessageAt: conv.lastMessageAt || conv.updatedAt,
      unreadCount: conv.unreadCount,
      status: conv.isActive ? 'OPEN' : 'CLOSED',
      avatar: null
    }))

    // If no stored conversations yet, return empty but don't fail
    if (formattedConversations.length === 0) {
      console.log('No stored conversations found, returning empty list')
      return NextResponse.json({ conversations: [] })
    }

    return NextResponse.json({ conversations: formattedConversations })

  } catch (err) {
    console.error('Facebook conversations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
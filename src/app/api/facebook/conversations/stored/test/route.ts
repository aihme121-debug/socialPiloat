import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

/**
 * Test endpoint for Facebook stored conversations without authentication
 * This is used for testing purposes only
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId') || 'test-business-id'
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    console.log('Testing Facebook stored conversations endpoint...')

    // Get conversations for testing
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId: businessId,
        platform: 'FACEBOOK',
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

    console.log(`Found ${conversations.length} conversations`)

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

    return NextResponse.json({ 
      success: true,
      conversations: formattedConversations,
      test: true,
      count: formattedConversations.length
    })

  } catch (err) {
    console.error('Facebook conversations test error:', err)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
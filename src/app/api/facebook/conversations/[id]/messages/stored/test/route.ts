import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

/**
 * Test endpoint for Facebook stored messages without authentication
 * This is used for testing purposes only
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    console.log(`Testing Facebook stored messages for conversation ${conversationId}...`)

    // Get messages for the conversation
    const messages = await prisma.chatMessage.findMany({
      where: {
        conversationId: conversationId,
        platform: 'FACEBOOK'
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    console.log(`Found ${messages.length} messages`)

    // Format messages for the frontend
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      messageId: msg.messageId,
      content: msg.content,
      sender: msg.senderId,
      recipient: msg.senderId, // Use senderId as recipient since we don't have recipientId
      timestamp: msg.createdAt,
      type: 'message', // Default to message type
      platform: 'FACEBOOK',
      conversationId: msg.conversationId
    }))

    return NextResponse.json({ 
      success: true,
      messages: formattedMessages.reverse(), // Reverse to show oldest first
      test: true,
      count: formattedMessages.length
    })

  } catch (err) {
    console.error('Facebook messages test error:', err)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
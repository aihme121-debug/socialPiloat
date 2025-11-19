import { NextRequest, NextResponse } from 'next/server'
import { FacebookMessageRetrievalService, MessageFilter } from '@/lib/services/facebook-message-retrieval-service'
import { logger } from '@/lib/logging/logger-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const messageRetrievalService = new FacebookMessageRetrievalService()

/**
 * GET /api/facebook/messages/retrieve
 * Retrieve authentic Facebook messages for a business page
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    const businessId = searchParams.get('businessId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const since = searchParams.get('since')
    const until = searchParams.get('until')
    const excludeAutomated = searchParams.get('excludeAutomated') !== 'false'
    const excludeSponsored = searchParams.get('excludeSponsored') !== 'false'
    const excludeHidden = searchParams.get('excludeHidden') !== 'false'
    const minConfidenceScore = parseFloat(searchParams.get('minConfidenceScore') || '0.5')

    if (!pageId || !businessId) {
      return NextResponse.json(
        { error: 'Missing required parameters: pageId and businessId' },
        { status: 400 }
      )
    }

    // Get the social account for the business
    const socialAccount = await getSocialAccount(businessId, pageId, session.user.id)
    if (!socialAccount?.accessToken) {
      return NextResponse.json(
        { error: 'Facebook account not connected or access token missing' },
        { status: 404 }
      )
    }

    // Initialize page messaging if not already done
    const isInitialized = await messageRetrievalService.initializePageMessaging(pageId, socialAccount.accessToken)
    if (!isInitialized) {
      return NextResponse.json(
        { error: 'Failed to initialize Facebook page messaging' },
        { status: 500 }
      )
    }

    // Build filter options
    const filter: Partial<MessageFilter> = {
      excludeAutomated,
      excludeSponsored,
      excludeHidden,
      excludeRemoved: true,
      excludeCustomerFeedback: true,
      excludeEchoMessages: false,
      minConfidenceScore
    }

    if (since) {
      filter.dateRange = {
        start: new Date(since),
        end: until ? new Date(until) : new Date()
      }
    }

    // Retrieve messages
    const options = {
      limit,
      filter,
      ...(since && { since: new Date(since) }),
      ...(until && { until: new Date(until) })
    }

    const messages = await messageRetrievalService.retrievePageMessages(pageId, options)

    // Get message statistics
    const stats = messageRetrievalService.getMessageStats(pageId)
    const lastSyncTime = messageRetrievalService.getLastSyncTime(pageId)

    logger.info('Facebook messages retrieved successfully', {
      pageId,
      businessId,
      totalMessages: messages.length,
      stats,
      lastSyncTime
    })

    return NextResponse.json({
      success: true,
      data: {
        messages,
        stats,
        lastSyncTime,
        pageId,
        businessId
      }
    })

  } catch (error) {
    logger.error('Error retrieving Facebook messages', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to retrieve Facebook messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/facebook/messages/retrieve
 * Refresh messages or handle webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pageId, businessId, action } = body

    if (!pageId || !businessId) {
      return NextResponse.json(
        { error: 'Missing required parameters: pageId and businessId' },
        { status: 400 }
      )
    }

    // Get the social account for the business
    const socialAccount = await getSocialAccount(businessId, pageId, session.user.id)
    if (!socialAccount?.accessToken) {
      return NextResponse.json(
        { error: 'Facebook account not connected or access token missing' },
        { status: 404 }
      )
    }

    let result

    switch (action) {
      case 'refresh':
        // Force refresh of messages
        result = await messageRetrievalService.retrievePageMessages(pageId, { limit: 50 })
        break

      case 'mark_read':
        // Mark messages as read
        const { messageIds } = body
        result = await markMessagesAsRead(messageIds, businessId)
        break

      case 'get_stats':
        // Get message statistics
        const stats = messageRetrievalService.getMessageStats(pageId)
        const lastSyncTime = messageRetrievalService.getLastSyncTime(pageId)
        result = { stats, lastSyncTime }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: refresh, mark_read, get_stats' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('Error processing Facebook messages request', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/facebook/messages/retrieve
 * Update message settings or filters
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pageId, action, settings } = body

    if (!pageId || !action) {
      return NextResponse.json(
        { error: 'Missing required parameters: pageId and action' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'stop_polling':
        // Stop polling for a page
        messageRetrievalService.stopPolling(pageId)
        return NextResponse.json({
          success: true,
          message: 'Polling stopped successfully'
        })

      case 'start_polling':
        // Start polling for a page
        const socialAccount = await getSocialAccountByPageId(pageId, session.user.id)
        if (!socialAccount?.accessToken) {
          return NextResponse.json(
            { error: 'Facebook account not connected or access token missing' },
            { status: 404 }
          )
        }
        
        await messageRetrievalService.initializePageMessaging(pageId, socialAccount.accessToken)
        return NextResponse.json({
          success: true,
          message: 'Polling started successfully'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: stop_polling, start_polling' },
          { status: 400 }
        )
    }

  } catch (error) {
    logger.error('Error updating Facebook messages settings', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get social account
 */
async function getSocialAccount(businessId: string, pageId: string, userId: string) {
  try {
    // This is a simplified version - you should implement proper authorization checks
    const business = await db.business.findFirst({
      where: {
        id: businessId
      },
      include: {
        users: {
          where: {
            id: userId
          }
        },
        socialAccounts: {
          where: {
            platform: 'FACEBOOK',
            accountId: pageId
          }
        }
      }
    })

    // Check if user has access to this business
    if (!business || business.users.length === 0) {
      return null
    }

    return business?.socialAccounts[0]
  } catch (error) {
    logger.error('Error getting social account', error instanceof Error ? error : undefined)
    return null
  }
}

/**
 * Helper function to get social account by page ID
 */
async function getSocialAccountByPageId(pageId: string, userId: string) {
  try {
    const socialAccount = await db.socialAccount.findFirst({
      where: {
        platform: 'FACEBOOK',
        accountId: pageId
      },
      include: {
        business: {
          include: {
            users: {
              where: {
                id: userId
              }
            }
          }
        }
      }
    })

    // Check if user has access to this business
    if (!socialAccount || !socialAccount.business || socialAccount.business.users.length === 0) {
      return null
    }

    return socialAccount
  } catch (error) {
    logger.error('Error getting social account by page ID', error instanceof Error ? error : undefined)
    return null
  }
}

/**
 * Helper function to mark messages as read
 */
async function markMessagesAsRead(messageIds: string[], businessId: string) {
  try {
    const result = await db.chatMessage.updateMany({
      where: {
        messageId: {
          in: messageIds
        },
        businessId: businessId
      },
      data: {
        isRead: true
      }
    })

    return result
  } catch (error) {
    logger.error('Error marking messages as read', error instanceof Error ? error : undefined)
    throw error
  }
}
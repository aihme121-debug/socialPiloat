import { NextRequest, NextResponse } from 'next/server'
import { FacebookMessagingService } from '@/lib/services/facebook-messaging-service'
import { logger } from '@/lib/logging/logger-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Get a specific auto-reply rule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const messagingService = new FacebookMessagingService()
    const rules = messagingService.getAutoReplyRules()
    const rule = rules.find(r => r.id === params.id)

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    logger.error(
      'Error fetching auto-reply rule',
      error instanceof Error ? error : undefined,
      {
        details: error instanceof Error ? error.message : 'Unknown error',
        ruleId: params.id
      }
    )
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Update an auto-reply rule
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const messagingService = new FacebookMessagingService()
    
    const updatedRule = await messagingService.updateAutoReplyRule(params.id, body)

    if (!updatedRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    logger.info('Auto-reply rule updated', {
      ruleId: params.id,
      userId: session.user.id
    })

    return NextResponse.json({ rule: updatedRule })
  } catch (error) {
    logger.error(
      'Error updating auto-reply rule',
      error instanceof Error ? error : undefined,
      {
        details: error instanceof Error ? error.message : 'Unknown error',
        ruleId: params.id
      }
    )
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Delete an auto-reply rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const messagingService = new FacebookMessagingService()
    const success = await messagingService.deleteAutoReplyRule(params.id)

    if (!success) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    logger.info('Auto-reply rule deleted', {
      ruleId: params.id,
      userId: session.user.id
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(
      'Error deleting auto-reply rule',
      error instanceof Error ? error : undefined,
      {
        details: error instanceof Error ? error.message : 'Unknown error',
        ruleId: params.id
      }
    )
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
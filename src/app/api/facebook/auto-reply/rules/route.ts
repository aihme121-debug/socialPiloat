import { NextRequest, NextResponse } from 'next/server'
import { FacebookMessagingService } from '@/lib/services/facebook-messaging-service'
import { logger } from '@/lib/logging/logger-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Get all auto-reply rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const messagingService = new FacebookMessagingService()
    const rules = messagingService.getAutoReplyRules()

    return NextResponse.json({ rules })
  } catch (error) {
    logger.error(
      'Error fetching auto-reply rules',
      error instanceof Error ? error : undefined,
      {
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    )
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Create a new auto-reply rule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, triggerKeywords, responseTemplate, confidenceThreshold, category, responseDelay } = body

    // Validate required fields
    if (!name || !triggerKeywords || !responseTemplate || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const messagingService = new FacebookMessagingService()
    const newRule = await messagingService.addAutoReplyRule({
      name,
      triggerKeywords,
      responseTemplate,
      confidenceThreshold: confidenceThreshold || 0.7,
      isActive: true,
      category,
      responseDelay: responseDelay || 2000
    })

    logger.info('Auto-reply rule created', {
      ruleId: newRule.id,
      name: newRule.name,
      userId: session.user.id
    })

    return NextResponse.json({ rule: newRule })
  } catch (error) {
    logger.error(
      'Error creating auto-reply rule',
      error instanceof Error ? error : undefined,
      {
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    )
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
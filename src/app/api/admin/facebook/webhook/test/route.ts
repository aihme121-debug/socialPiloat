import { NextRequest, NextResponse } from 'next/server'
import { FacebookWebhookService } from '@/lib/services/facebook-webhook-service'
import { systemMonitor } from '@/lib/system/system-monitor-js'
import { logger, LogLevel } from '@/lib/logging/logger-service'

export async function POST(request: NextRequest) {
  try {
    const { pageId, message, testType = 'message' } = await request.json()

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    const webhookService = FacebookWebhookService.getInstance()
    
    // Create test webhook payload
    const testPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Date.now(),
        messaging: [{
          sender: { id: 'test_user_123' },
          recipient: { id: pageId },
          timestamp: Date.now(),
          message: {
            mid: `test_msg_${Date.now()}`,
            text: message || 'Test message from admin dashboard'
          }
        }]
      }]
    }

    logger.info('Testing Facebook webhook', { 
      pageId, 
      testType,
      message: message || 'Test message from admin dashboard'
    })

    // Process the test webhook
    await webhookService.processWebhook(testPayload as any)

    // Log the test event
    systemMonitor.log('facebook', 'Webhook test completed', LogLevel.INFO, {
      pageId,
      testType,
      message: message || 'Test message from admin dashboard'
    })

    return NextResponse.json({
      success: true,
      message: 'Webhook test completed successfully',
      testPayload,
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Failed to test Facebook webhook', error as Error)
    
    return NextResponse.json(
      { error: 'Failed to test Facebook webhook' },
      { status: 500 }
    )
  }
}
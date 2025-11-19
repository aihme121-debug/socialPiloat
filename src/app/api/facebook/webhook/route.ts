import { NextRequest, NextResponse } from 'next/server'
import { FacebookWebhookService } from '@/lib/services/facebook-webhook-service'
import { FacebookConfigService } from '@/lib/services/facebook-config-service'
import { systemMonitor } from '@/lib/system/system-monitor-js'
import { logger } from '@/lib/logging/logger-service'
import { emitToAdmin } from '@/lib/socket/socket-server'

// Facebook webhook verification
export async function GET(request: NextRequest) {
  try {
    const configService = FacebookConfigService.getInstance()
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    // Verify the webhook
    if (mode && token) {
      const verifyToken = configService.getVerifyToken()
      
      if (mode === 'subscribe' && token === verifyToken) {
        logger.info('Facebook webhook verified successfully')
        systemMonitor.updateFacebookWebhookStatus(true)
        
        // Validate webhook configuration
        await configService.validateWebhookConfiguration()
        
        return new NextResponse(challenge, { status: 200 })
      } else {
        logger.error('Facebook webhook verification failed', undefined, { mode, token })
        systemMonitor.updateFacebookWebhookStatus(false)
        return new NextResponse('Verification failed', { status: 403 })
      }
    }

    return new NextResponse('Bad Request', { status: 400 })
  } catch (error) {
    logger.error(
      'Error in Facebook webhook verification',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error' }
    )
    systemMonitor.updateFacebookWebhookStatus(false)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Handle incoming Facebook messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    logger.info('Received Facebook webhook event', { 
      object: body.object,
      entryCount: body.entry?.length || 0
    })

    // Update Facebook webhook status
    systemMonitor.updateFacebookWebhookStatus(true)

    // Use FacebookWebhookService to process the webhook
    const webhookService = FacebookWebhookService.getInstance()
    await webhookService.processWebhook(body)

    try {
      systemMonitor.broadcastEvent('facebook-webhook', { event: 'message', timestamp: new Date().toISOString() })
      emitToAdmin('facebook-webhook', { event: 'message', timestamp: new Date().toISOString() })
    } catch {}

    // Return 200 OK to Facebook
    return new NextResponse('EVENT_RECEIVED', { status: 200 })
  } catch (error) {
    logger.error(
      'Error processing Facebook webhook',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error' }
    )
    // Keep webhook marked as connected; log the error without flipping status
    // Still return 200 to prevent Facebook from retrying
    return new NextResponse('EVENT_RECEIVED', { status: 200 })
  }
}
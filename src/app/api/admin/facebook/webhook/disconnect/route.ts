import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger-service'
import { facebookConnectionManager } from '@/lib/services/facebook-connection-manager'

export async function POST(request: NextRequest) {
  try {
    logger.info('Disconnecting Facebook webhook via connection manager')
    
    await facebookConnectionManager.disconnectWebhook()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Facebook webhook disconnected successfully',
      status: facebookConnectionManager.getConnectionStatus().webhook
    })
  } catch (error) {
    logger.error('Webhook disconnection endpoint failed', error as Error)
    return NextResponse.json({ 
      success: false, 
      error: 'Webhook disconnection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
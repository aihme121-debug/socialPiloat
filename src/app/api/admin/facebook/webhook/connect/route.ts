import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger-service'
import { facebookConnectionManager } from '@/lib/services/facebook-connection-manager'

export async function POST(request: NextRequest) {
  try {
    logger.info('Connecting Facebook webhook via connection manager')
    
    const success = await facebookConnectionManager.connectWebhook()
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Facebook webhook connected successfully',
        status: facebookConnectionManager.getConnectionStatus().webhook
      })
    } else {
      const status = facebookConnectionManager.getConnectionStatus().webhook
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to connect Facebook webhook',
        lastError: status.lastError,
        attempts: status.reconnectAttempts
      }, { status: 500 })
    }
  } catch (error) {
    logger.error('Webhook connection endpoint failed', error as Error)
    return NextResponse.json({ 
      success: false, 
      error: 'Webhook connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
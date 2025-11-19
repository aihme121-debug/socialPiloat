import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger-service'
import { facebookConnectionManager } from '@/lib/services/facebook-connection-manager'

export async function POST(request: NextRequest) {
  try {
    logger.info('Connecting Facebook Graph API via connection manager')
    
    const success = await facebookConnectionManager.connectApi()
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Facebook Graph API connected successfully',
        status: facebookConnectionManager.getConnectionStatus().api
      })
    } else {
      const status = facebookConnectionManager.getConnectionStatus().api
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to connect Facebook Graph API',
        lastError: status.lastError,
        attempts: status.reconnectAttempts
      }, { status: 500 })
    }
  } catch (error) {
    logger.error('API connection endpoint failed', error as Error)
    return NextResponse.json({ 
      success: false, 
      error: 'API connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
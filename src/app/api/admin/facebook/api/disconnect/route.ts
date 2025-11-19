import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger-service'
import { facebookConnectionManager } from '@/lib/services/facebook-connection-manager'

export async function POST(request: NextRequest) {
  try {
    logger.info('Disconnecting Facebook Graph API via connection manager')
    
    await facebookConnectionManager.disconnectApi()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Facebook Graph API disconnected successfully',
      status: facebookConnectionManager.getConnectionStatus().api
    })
  } catch (error) {
    logger.error('API disconnection endpoint failed', error as Error)
    return NextResponse.json({ 
      success: false, 
      error: 'API disconnection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
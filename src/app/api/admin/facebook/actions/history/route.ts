import { NextRequest, NextResponse } from 'next/server'
import { FacebookActionsService } from '@/lib/services/facebook-actions-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

const actionsService = new FacebookActionsService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
        { status: 400 }
      )
    }

    // Get action history
    const result = await actionsService.getActionHistory(pageId, limit)

    if (result.success) {
      logger.info('Action history fetched successfully', { pageId, count: result.actions?.length })
      systemMonitor.log('facebook-actions', 'History fetched', 'info', { 
        pageId, 
        count: result.actions?.length 
      })
      
      return NextResponse.json({
        success: true,
        actions: result.actions
      })
    } else {
      logger.error('Failed to fetch action history', { pageId, error: result.error })
      systemMonitor.log('facebook-actions', 'History fetch failed', 'error', { 
        pageId, 
        error: result.error 
      })
      
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

  } catch (error) {
    logger.error('Get action history API error', { error: error.message })
    systemMonitor.log('facebook-actions', 'API error', 'error', { error: error.message })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
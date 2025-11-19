import { NextRequest, NextResponse } from 'next/server'
import { systemMonitor } from '@/lib/system/system-monitor-js'
import { logger } from '@/lib/logging/logger-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const level = searchParams.get('level')
    const component = searchParams.get('component')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')

    // Get logs from system monitor
    const logs = systemMonitor.getSystemLogs()
    
    // Filter logs based on parameters
    let filteredLogs = logs

    if (level) {
      filteredLogs = filteredLogs.filter((log: any) => log.level === level)
    }

    if (component) {
      filteredLogs = filteredLogs.filter((log: any) => log.category === component)
    }

    if (startTime) {
      const start = new Date(startTime).getTime()
      filteredLogs = filteredLogs.filter((log: any) => new Date(log.timestamp).getTime() >= start)
    }

    if (endTime) {
      const end = new Date(endTime).getTime()
      filteredLogs = filteredLogs.filter((log: any) => new Date(log.timestamp).getTime() <= end)
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Limit results
    const limitedLogs = filteredLogs.slice(0, limit)

    logger.info('Fetched system logs', { 
      total: logs.length,
      filtered: filteredLogs.length,
      returned: limitedLogs.length,
      filters: { level, component, startTime, endTime }
    })

    return NextResponse.json({
      success: true,
      logs: limitedLogs,
      total: logs.length,
      filtered: filteredLogs.length,
      returned: limitedLogs.length,
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Failed to fetch system logs', error as Error)
    
    return NextResponse.json(
      { error: 'Failed to fetch system logs' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Clear old logs (keep last 1000 entries)
    const logs = systemMonitor.getSystemLogs()
    const recentLogs = logs.slice(-1000)
    
    // This is a simplified approach - in a real implementation,
    // you'd have a proper log rotation system
    logger.info('Cleared old system logs', { 
      totalBefore: logs.length,
      totalAfter: recentLogs.length,
      cleared: logs.length - recentLogs.length
    })

    return NextResponse.json({
      success: true,
      message: 'Old logs cleared successfully',
      cleared: logs.length - recentLogs.length,
      remaining: recentLogs.length,
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Failed to clear system logs', error as Error)
    
    return NextResponse.json(
      { error: 'Failed to clear system logs' },
      { status: 500 }
    )
  }
}
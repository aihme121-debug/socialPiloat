import { NextRequest, NextResponse } from 'next/server'
import { emitToAdmin } from '@/lib/socket/socket-server'
import { systemMonitor } from '@/lib/system/system-monitor-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    systemMonitor.broadcastEvent('new-message', body || { id: `test-${Date.now()}`, content: 'hello' })
    emitToAdmin('new-message', body || { id: `test-${Date.now()}`, content: 'hello' })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'unknown' }, { status: 500 })
  }
}
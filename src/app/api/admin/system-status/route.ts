import { NextRequest, NextResponse } from 'next/server';
import { systemMonitor } from '@/lib/system/system-monitor';

/**
 * GET /api/admin/system-status
 * Returns current system status
 */
export async function GET(request: NextRequest) {
  try {
    const status = systemMonitor.getSystemStatus();
    
    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get system status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get system status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { systemMonitor } from '@/lib/system/system-monitor-realtime';

/**
 * GET /api/admin/system-status/realtime
 * Returns current system status with real-time updates
 */
export async function GET(request: NextRequest) {
  try {
    const status = systemMonitor.getSystemStatus();
    const stats = systemMonitor.getSystemStats();
    
    return NextResponse.json({
      success: true,
      status,
      stats,
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

/**
 * POST /api/admin/system-status/realtime
 * Update system status or trigger status checks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, component, data } = body;
    
    switch (action) {
      case 'update-facebook-webhook':
        if (data && typeof data.connected === 'boolean') {
          systemMonitor.updateFacebookWebhookStatus(data.connected, data.disconnectReason);
        }
        break;
        
      case 'update-facebook-api':
        if (data && data.status) {
          systemMonitor.updateFacebookApiStatus(data.status, data.responseTime, data.errorMessage);
        }
        break;
        
      case 'update-socket-server':
        if (data && typeof data.running === 'boolean') {
          systemMonitor.updateSocketServerStatus(data.running, data.connections || 0);
        }
        break;
        
      case 'update-ngrok':
        if (data && typeof data.active === 'boolean') {
          systemMonitor.updateNgrokStatus(data.active, data.url, data.error);
        }
        break;
        
      case 'log-server-restart':
        systemMonitor.logServerRestart(data?.reason);
        break;
        
      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action',
            availableActions: [
              'update-facebook-webhook',
              'update-facebook-api',
              'update-socket-server',
              'update-ngrok',
              'log-server-restart'
            ]
          },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      message: `Action ${action} completed successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to update system status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update system status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
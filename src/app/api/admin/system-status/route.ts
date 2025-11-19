import { NextRequest, NextResponse } from 'next/server';
import { systemMonitor } from '@/lib/system/system-monitor';
import { facebookConnectionManager } from '@/lib/services/facebook-connection-manager';

/**
 * GET /api/admin/system-status
 * Returns current system status
 */
export async function GET(request: NextRequest) {
  try {
    const status = systemMonitor.getSystemStatus();
    
    // Get real Facebook connection status from connection manager
    try {
      const fbStatus = facebookConnectionManager.getConnectionStatus();
      status.facebook.webhook.connected = fbStatus.webhook.connected;
      status.facebook.webhook.lastConnection = fbStatus.webhook.lastConnection instanceof Date 
        ? fbStatus.webhook.lastConnection.toISOString() 
        : (fbStatus.webhook.lastConnection || new Date()).toString();
      status.facebook.webhook.reconnectAttempts = fbStatus.webhook.reconnectAttempts;
      status.facebook.webhook.errorCount = fbStatus.webhook.errorCount;
      
      status.facebook.api.status = fbStatus.api.connected ? 'connected' : 'disconnected';
      status.facebook.api.lastResponse = fbStatus.api.lastConnection instanceof Date 
        ? fbStatus.api.lastConnection.toISOString() 
        : (fbStatus.api.lastConnection || new Date()).toString();
    } catch (fbError) {
      console.error('Failed to get Facebook connection status:', fbError);
    }
    
    try {
      const resp = await fetch('http://127.0.0.1:4040/api/tunnels');
      if (resp.ok) {
        const tunnels = await resp.json();
        const httpTunnel = Array.isArray(tunnels.tunnels)
          ? tunnels.tunnels.find((t: any) => t.proto === 'https' || t.proto === 'http')
          : null;
        if (httpTunnel && httpTunnel.public_url) {
          if (!status.ngrok) status.ngrok = { tunnel: {} as any } as any;
          if (!status.ngrok.tunnel) status.ngrok.tunnel = {} as any;
          (status.ngrok.tunnel as any).active = true;
          (status.ngrok.tunnel as any).url = httpTunnel.public_url;
          (status.ngrok.tunnel as any).establishedAt = new Date().toISOString();
        }
      }
    } catch (e) {}
    
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
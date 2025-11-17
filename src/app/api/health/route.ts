import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from '@/lib/monitoring/monitoring-service';

export async function GET(request: NextRequest) {
  try {
    const healthCheck = await monitoringService.performHealthCheck();
    
    // Determine HTTP status code based on health status
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 503 : 503;
    
    return NextResponse.json(healthCheck, { status: statusCode });
  } catch (error) {
    monitoringService.logError(error instanceof Error ? error : new Error('Health check failed'));
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
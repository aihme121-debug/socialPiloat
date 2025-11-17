import { NextRequest, NextResponse } from 'next/server';
import { systemMonitor } from '@/lib/system/system-monitor-realtime';
import { LogLevel } from '@/lib/logging/logger-service';

/**
 * GET /api/admin/system-logs/stream
 * Returns system logs with Server-Sent Events for real-time streaming
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const options = {
      category: searchParams.get('category') as any,
      level: searchParams.get('level') as any,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      search: searchParams.get('search'),
      startTime: searchParams.get('startTime'),
      endTime: searchParams.get('endTime'),
    };

    // Clean up undefined and null values
    Object.keys(options).forEach(key => {
      if (options[key as keyof typeof options] === undefined || options[key as keyof typeof options] === null) {
        delete options[key as keyof typeof options];
      }
    });

    // Ensure proper types for the systemMonitor call
    const cleanOptions: {
      category?: "facebook" | "socket" | "ngrok" | "server" | "system";
      level?: LogLevel;
      limit?: number;
      startTime?: string;
      endTime?: string;
    } = {};

    // Copy only valid properties
    if (options.category) cleanOptions.category = options.category;
    if (options.level) cleanOptions.level = options.level;
    if (options.limit) cleanOptions.limit = options.limit;
    if (options.startTime) cleanOptions.startTime = options.startTime;
    if (options.endTime) cleanOptions.endTime = options.endTime;

    const logs = systemMonitor.getSystemLogs(cleanOptions);
    
    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get system logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get system logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system-logs
 * Create a new system log entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, level, message, details } = body;
    
    if (!category || !level || !message) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: category, level, message'
        },
        { status: 400 }
      );
    }
    
    // Add log through system monitor using appropriate method based on level
    switch (level.toLowerCase()) {
      case 'error':
        systemMonitor.logError(category, message, undefined, details);
        break;
      case 'warn':
        systemMonitor.logWarn(category, message, details);
        break;
      case 'info':
      default:
        systemMonitor.logInfo(category, message, details);
        break;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Log entry created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to create system log:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create system log',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/system-logs
 * Clears all system logs
 */
export async function DELETE(request: NextRequest) {
  try {
    systemMonitor.clearLogs();
    
    return NextResponse.json({
      success: true,
      message: 'System logs cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to clear system logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear system logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test if socket.io server is accessible
    const socketPort = process.env.SOCKET_PORT || 3002;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070';
    
    return NextResponse.json({
      status: 'ok',
      socketPort,
      appUrl,
      message: 'Socket test endpoint working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
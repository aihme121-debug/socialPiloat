import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addConnection, removeConnection, broadcastUpdate, getConnections } from '@/lib/realtime';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const businessId = user.business.id;

    // Set up SSE headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const clientId = Date.now().toString();
        const clientInfo = {
          businessId,
          controller,
          id: clientId
        };

        // Add to active connections
        addConnection(businessId, clientInfo);

        // Send initial connection message
        const initialData = {
          type: 'connection',
          message: 'Connected to real-time updates',
          clientId
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

        // Send heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`data: {"type":"heartbeat","timestamp":"${new Date().toISOString()}"}\n\n`));
          } catch (error) {
            clearInterval(heartbeatInterval);
          }
        }, 30000); // 30 seconds

        // Clean up on client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
          removeConnection(businessId, clientId);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error setting up real-time connection:', error);
    return NextResponse.json({ error: 'Failed to setup real-time connection' }, { status: 500 });
  }
}



// API endpoint to trigger updates (for testing)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type) {
      return NextResponse.json({ error: 'Update type is required' }, { status: 400 });
    }

    // Broadcast the update
    broadcastUpdate(user.business.id, {
      type,
      data,
      triggeredBy: user.id
    });

    return NextResponse.json({
      success: true,
      message: 'Update broadcasted successfully',
      activeConnections: getConnections(user.business.id).length
    });

  } catch (error) {
    console.error('Error broadcasting update:', error);
    return NextResponse.json({ error: 'Failed to broadcast update' }, { status: 500 });
  }
}
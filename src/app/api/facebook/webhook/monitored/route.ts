import { NextRequest, NextResponse } from 'next/server';
import { systemMonitor } from '@/lib/system/system-monitor-js';
import { logger } from '@/lib/logging/logger-service';

/**
 * Enhanced Facebook webhook handler with monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    
    // Log webhook receipt
    systemMonitor.logInfo('facebook', 'Facebook webhook received', {
      signature: signature ? 'present' : 'missing',
      bodySize: body.length,
    });

    // Parse the webhook data
    let webhookData;
    try {
      webhookData = JSON.parse(body);
    } catch (parseError) {
      systemMonitor.logError('facebook', 'Failed to parse webhook body', parseError as Error);
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Update Facebook webhook status
    systemMonitor.updateFacebookWebhookStatus(true);

    // Process different webhook types
    if (webhookData.object === 'page') {
      for (const entry of webhookData.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            await processFacebookChange(change, entry.id);
          }
        }
        
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            await processFacebookMessage(messagingEvent, entry.id);
          }
        }
      }
    }

    systemMonitor.logInfo('facebook', 'Facebook webhook processed successfully', {
      object: webhookData.object,
      entryCount: webhookData.entry?.length || 0,
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    systemMonitor.logError('facebook', 'Facebook webhook processing failed', error as Error);
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Facebook webhook verification
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token) {
      // Verify the token (you should validate against your stored token)
      const expectedToken = process.env.FACEBOOK_VERIFY_TOKEN;
      
      if (token === expectedToken) {
        systemMonitor.logInfo('facebook', 'Facebook webhook verification successful');
        systemMonitor.updateFacebookWebhookStatus(true);
        return new NextResponse(challenge, { status: 200 });
      } else {
        systemMonitor.logWarn('facebook', 'Facebook webhook verification failed - invalid token');
        return NextResponse.json(
          { error: 'Invalid verification token' },
          { status: 403 }
        );
      }
    }

    systemMonitor.logWarn('facebook', 'Facebook webhook verification failed - invalid parameters');
    return NextResponse.json(
      { error: 'Invalid parameters' },
      { status: 400 }
    );

  } catch (error) {
    systemMonitor.logError('facebook', 'Facebook webhook verification error', error as Error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

/**
 * Process Facebook change events
 */
async function processFacebookChange(change: any, pageId: string) {
  try {
    systemMonitor.logInfo('facebook', 'Processing Facebook change event', {
      pageId,
      field: change.field,
      value: change.value,
    });

    // Add your change processing logic here
    // For example: handle page posts, comments, etc.
    
  } catch (error) {
    systemMonitor.logError('facebook', 'Failed to process Facebook change', error as Error, {
      pageId,
      change,
    });
  }
}

/**
 * Process Facebook messaging events
 */
async function processFacebookMessage(messagingEvent: any, pageId: string) {
  try {
    systemMonitor.logInfo('facebook', 'Processing Facebook messaging event', {
      pageId,
      sender: messagingEvent.sender?.id,
      recipient: messagingEvent.recipient?.id,
      timestamp: messagingEvent.timestamp,
    });

    // Add your messaging processing logic here
    // For example: handle incoming messages, postbacks, etc.
    
  } catch (error) {
    systemMonitor.logError('facebook', 'Failed to process Facebook message', error as Error, {
      pageId,
      messagingEvent,
    });
  }
}
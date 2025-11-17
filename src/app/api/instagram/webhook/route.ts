import { NextRequest, NextResponse } from 'next/server';

// Instagram webhook verification and processing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('Instagram webhook verification attempt:', { mode, token });

  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log('Instagram webhook verification successful');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.log('Instagram webhook verification failed');
    return new NextResponse('Verification failed', { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    
    console.log('Instagram webhook received:', { signature: signature?.substring(0, 20) + '...' });

    // Verify webhook signature (Instagram uses the same verification as Facebook)
    if (signature && process.env.FACEBOOK_APP_SECRET) {
      const crypto = await import('crypto');
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', process.env.FACEBOOK_APP_SECRET)
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.log('Instagram webhook signature verification failed');
        return new NextResponse('Invalid signature', { status: 401 });
      }
    }

    const data = JSON.parse(body);
    console.log('Instagram webhook data received:', JSON.stringify(data, null, 2));

    // Process Instagram webhook events
    if (data.object === 'instagram') {
      for (const entry of data.entry) {
        const instagramId = entry.id;
        const time = entry.time;

        console.log(`Processing Instagram account ${instagramId} at ${new Date(time).toISOString()}`);

        // Handle Instagram Basic Display API webhooks
        if (entry.changes) {
          for (const change of entry.changes) {
            await handleInstagramChange(change, instagramId);
          }
        }

        // Handle Instagram Graph API webhooks (for business accounts)
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            await handleInstagramMessaging(messagingEvent);
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Instagram webhook error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

async function handleInstagramChange(change: any, instagramId: string) {
  const field = change.field;
  const value = change.value;
  
  console.log(`Instagram change for account ${instagramId}:`, {
    field,
    media_id: value.media_id,
    comment_id: value.comment_id,
    text: value.text,
    time: value.time
  });

  // Handle different Instagram webhook events
  switch (field) {
    case 'media':
      console.log('Instagram media update:', {
        media_id: value.media_id,
        media_type: value.media_type,
        permalink: value.permalink
      });
      break;
      
    case 'comments':
      console.log('Instagram comment:', {
        comment_id: value.comment_id,
        media_id: value.media_id,
        text: value.text,
        username: value.username,
        timestamp: value.timestamp
      });
      break;
      
    case 'mentions':
      console.log('Instagram mention:', {
        media_id: value.media_id,
        comment_id: value.comment_id,
        text: value.text,
        username: value.username
      });
      break;
      
    case 'story_insights':
      console.log('Instagram story insights:', {
        media_id: value.media_id,
        impressions: value.impressions,
        reach: value.reach,
        replies: value.replies
      });
      break;
      
    case 'insights':
      console.log('Instagram account insights:', {
        impressions: value.impressions,
        reach: value.reach,
        profile_views: value.profile_views,
        website_clicks: value.website_clicks
      });
      break;
  }
}

async function handleInstagramMessaging(event: any) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp;
  
  console.log(`Instagram message from ${senderId} to ${recipientId} at ${new Date(timestamp).toISOString()}`);

  if (event.message) {
    const message = event.message;
    console.log('Instagram message content:', {
      text: message.text,
      attachments: message.attachments?.length || 0
    });

    // Handle text message
    if (message.text) {
      console.log('Processing Instagram text message:', message.text);
    }

    // Handle attachments (images, videos, etc.)
    if (message.attachments) {
      for (const attachment of message.attachments) {
        console.log('Instagram attachment received:', {
          type: attachment.type,
          url: attachment.payload?.url
        });
      }
    }
  }
}
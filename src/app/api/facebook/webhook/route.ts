import { NextRequest, NextResponse } from 'next/server'
import { FacebookMessagingService } from '@/lib/services/facebook-messaging-service'
import { logger } from '@/lib/logging/logger-service'
import { prisma } from '@/lib/prisma'
import { SocialPlatform } from '@prisma/client'

// Facebook webhook verification
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    // Verify the webhook
    if (mode && token) {
      const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
      
      if (mode === 'subscribe' && token === verifyToken) {
        logger.info('Facebook webhook verified successfully')
        return new NextResponse(challenge, { status: 200 })
      } else {
        logger.error('Facebook webhook verification failed', undefined, { mode, token })
        return new NextResponse('Verification failed', { status: 403 })
      }
    }

    return new NextResponse('Bad Request', { status: 400 })
  } catch (error) {
    logger.error(
      'Error in Facebook webhook verification',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error' }
    )
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

// Handle incoming Facebook messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    logger.info('Received Facebook webhook event', { 
      object: body.object,
      entryCount: body.entry?.length || 0
    })

    // Check if this is a page object (Facebook page messages)
    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        // Handle messaging events
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            await handleMessagingEvent(messagingEvent)
          }
        }

        // Handle Instagram messaging events
        if (entry.messagingInstagram) {
          for (const messagingEvent of entry.messagingInstagram) {
            await handleInstagramMessagingEvent(messagingEvent)
          }
        }
      }
    }

    // Return 200 OK to Facebook
    return new NextResponse('EVENT_RECEIVED', { status: 200 })
  } catch (error) {
    logger.error(
      'Error processing Facebook webhook',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error' }
    )
    // Still return 200 to prevent Facebook from retrying
    return new NextResponse('EVENT_RECEIVED', { status: 200 })
  }
}

async function handleMessagingEvent(messagingEvent: any) {
  try {
    // Handle message event
    if (messagingEvent.message && messagingEvent.message.text) {
      await handleIncomingMessage(messagingEvent)
    }

    // Handle postback event (for structured messages)
    if (messagingEvent.postback) {
      await handlePostbackEvent(messagingEvent)
    }

    // Handle message delivery confirmation
    if (messagingEvent.delivery) {
    logger.info('Message delivered', { 
      watermark: messagingEvent.delivery.watermark,
      messageIds: messagingEvent.delivery.mids
    })
    }

  } catch (error) {
    logger.error(
      'Error handling messaging event',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', messagingEvent }
    )
  }
}

async function handleIncomingMessage(messagingEvent: any) {
  try {
    const senderId = messagingEvent.sender.id
    const recipientId = messagingEvent.recipient.id // This is the page ID
    const message = messagingEvent.message
    const messageText = message.text
    const messageId = messagingEvent.message.mid
    const timestamp = new Date(messagingEvent.timestamp)

    logger.info('Processing incoming message', {
      senderId,
      recipientId,
      messageId,
      messageText
    })

    // Get the social account and business information
    const socialAccount = await getSocialAccountByPlatformId(recipientId, SocialPlatform.FACEBOOK)
    if (!socialAccount) {
      logger.warn('Social account not found for recipient', { recipientId })
      return
    }

    const business = await getBusinessBySocialAccount(socialAccount.id)
    if (!business) {
      logger.warn('Business not found for social account', { socialAccountId: socialAccount.id })
      return
    }

    // Create message context
    const messageContext = {
      messageId,
      senderId,
      senderName: await getSenderName(senderId, socialAccount.accessToken),
      content: messageText,
      platform: 'FACEBOOK' as const,
      accountId: socialAccount.id,
      businessId: business.id,
      timestamp
    }

    // Process the message with FacebookMessagingService
    const messagingService = new FacebookMessagingService()
    await messagingService.processIncomingMessage(messageContext)

  } catch (error) {
    logger.error(
      'Error handling incoming message',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', messagingEvent }
    )
  }
}

async function handlePostbackEvent(messagingEvent: any) {
  try {
    const senderId = messagingEvent.sender.id
    const recipientId = messagingEvent.recipient.id
    const postback = messagingEvent.postback
    const payload = postback.payload

    logger.info('Processing postback event', {
      senderId,
      recipientId,
      payload
    })

    // Handle different postback payloads
    switch (payload) {
      case 'GET_STARTED_PAYLOAD':
        await handleGetStarted(senderId, recipientId)
        break
      case 'HELP_PAYLOAD':
        await handleHelpRequest(senderId, recipientId)
        break
      default:
        logger.info('Unknown postback payload', { payload })
    }

  } catch (error) {
    logger.error(
      'Error handling postback event',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', messagingEvent }
    )
  }
}

async function handleInstagramMessagingEvent(messagingEvent: any) {
  // Similar to handleMessagingEvent but for Instagram
  // Implementation would be similar but with Instagram-specific logic
  logger.info('Instagram messaging event received', { messagingEvent })
}

async function getSocialAccountByPlatformId(platformId: string, platform: SocialPlatform) {
  try {
    const socialAccount = await prisma.socialAccount.findFirst({
      where: {
        accountId: platformId,
        platform
      }
    })
    return socialAccount
  } catch (error) {
    logger.error(
      'Error getting social account',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', platformId, platform }
    )
    return null
  }
}

async function getBusinessBySocialAccount(socialAccountId: string) {
  try {
    const business = await prisma.business.findFirst({
      where: {
        socialAccounts: {
          some: {
            id: socialAccountId
          }
        }
      }
    })
    return business
  } catch (error) {
    logger.error(
      'Error getting business by social account',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', socialAccountId }
    )
    return null
  }
}

async function getSenderName(senderId: string, accessToken: string): Promise<string> {
  try {
    const url = `https://graph.facebook.com/v18.0/${senderId}?access_token=${accessToken}`
    const response = await fetch(url)
    const data = await response.json()
    
    return data.first_name || data.name || 'Unknown User'
  } catch (error) {
    logger.error(
      'Error getting sender name',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', senderId }
    )
    return 'Unknown User'
  }
}

async function handleGetStarted(senderId: string, recipientId: string) {
  try {
    const welcomeMessage = "Welcome to SocialPiloat.Ai! 🎉 I'm here to help you with any questions about our social media management platform. How can I assist you today?"
    
    // Send welcome message
    const messagingService = new FacebookMessagingService()
    const socialAccount = await getSocialAccountByPlatformId(recipientId, SocialPlatform.FACEBOOK)
    
    if (socialAccount) {
      await messagingService.sendMessage(
        socialAccount.id,
        senderId,
        welcomeMessage,
        SocialPlatform.FACEBOOK
      )
    }
  } catch (error) {
    logger.error(
      'Error handling get started',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', senderId, recipientId }
    )
  }
}

async function handleHelpRequest(senderId: string, recipientId: string) {
  try {
    const helpMessage = "Here's how I can help you: \n\n📊 Learn about our features\n💰 Get pricing information\n🛠️ Get technical support\n📞 Contact our team\n\nWhat would you like to know about?"
    
    // Send help message
    const messagingService = new FacebookMessagingService()
    const socialAccount = await getSocialAccountByPlatformId(recipientId, SocialPlatform.FACEBOOK)
    
    if (socialAccount) {
      await messagingService.sendMessage(
        socialAccount.id,
        senderId,
        helpMessage,
        SocialPlatform.FACEBOOK
      )
    }
  } catch (error) {
    logger.error(
      'Error handling help request',
      error instanceof Error ? error : undefined,
      { details: error instanceof Error ? error.message : 'Unknown error', senderId, recipientId }
    )
  }
}
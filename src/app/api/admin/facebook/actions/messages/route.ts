import { NextRequest, NextResponse } from 'next/server'
import { FacebookActionsService } from '@/lib/services/facebook-actions-service'
import { TokenEncryptionService } from '@/lib/services/token-encryption-service'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

const actionsService = new FacebookActionsService()
const encryptionService = new TokenEncryptionService()

export async function POST(request: NextRequest) {
  try {
    const { pageId, recipientId, message, messagingType = 'RESPONSE', tag } = await request.json()

    // Validate required parameters
    if (!pageId || !recipientId || !message) {
      return NextResponse.json(
        { success: false, error: 'pageId, recipientId, and message are required' },
        { status: 400 }
      )
    }

    // Get the page from database
    const page = await prisma.facebookPage.findUnique({
      where: { facebookPageId: pageId }
    })

    if (!page) {
      return NextResponse.json(
        { success: false, error: 'Page not found in database' },
        { status: 404 }
      )
    }

    // Decrypt the page access token
    const pageAccessToken = encryptionService.decrypt(page.pageAccessTokenEncrypted)

    // Send the message
    const result = await actionsService.sendMessage({
      pageId,
      recipientId,
      message,
      pageAccessToken,
      messagingType,
      tag
    })

    if (result.success) {
      logger.info('Message sent successfully', { pageId, recipientId, messageId: result.messageId })
      systemMonitor.log('facebook-actions', 'Message sent', 'info', { 
        pageId, 
        recipientId, 
        messageId: result.messageId 
      })
      
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        details: result.details
      })
    } else {
      logger.error('Failed to send message', { pageId, recipientId, error: result.error })
      systemMonitor.log('facebook-actions', 'Message failed', 'error', { 
        pageId, 
        recipientId, 
        error: result.error 
      })
      
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 400 })
    }

  } catch (error) {
    logger.error('Send message API error', { error: error.message })
    systemMonitor.log('facebook-actions', 'API error', 'error', { error: error.message })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
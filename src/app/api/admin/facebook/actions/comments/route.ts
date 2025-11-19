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
    const { pageId, objectId, message } = await request.json()

    // Validate required parameters
    if (!pageId || !objectId || !message) {
      return NextResponse.json(
        { success: false, error: 'pageId, objectId, and message are required' },
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

    // Send the comment
    const result = await actionsService.sendComment({
      pageId,
      objectId,
      message,
      pageAccessToken
    })

    if (result.success) {
      logger.info('Comment sent successfully', { pageId, objectId, commentId: result.commentId })
      systemMonitor.log('facebook-actions', 'Comment sent', 'info', { 
        pageId, 
        objectId, 
        commentId: result.commentId 
      })
      
      return NextResponse.json({
        success: true,
        commentId: result.commentId,
        details: result.details
      })
    } else {
      logger.error('Failed to send comment', { pageId, objectId, error: result.error })
      systemMonitor.log('facebook-actions', 'Comment failed', 'error', { 
        pageId, 
        objectId, 
        error: result.error 
      })
      
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 400 })
    }

  } catch (error) {
    logger.error('Send comment API error', { error: error.message })
    systemMonitor.log('facebook-actions', 'API error', 'error', { error: error.message })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
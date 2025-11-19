import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FacebookWebhookManager } from '@/lib/services/facebook-webhook-manager'
import { TokenEncryptionService } from '@/lib/services/token-encryption-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

const webhookManager = new FacebookWebhookManager()
const encryptionService = new TokenEncryptionService()

export async function POST(request: NextRequest) {
  try {
    const { pageId, subscribedFields = ['messages', 'messaging_postbacks', 'messaging_deliveries', 'messaging_reads'] } = await request.json()

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
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

    // Subscribe to webhook events
    const result = await webhookManager.subscribePage({
      pageId,
      pageAccessToken,
      subscribedFields,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070'}/api/webhooks/facebook`,
      verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || 'default_verify_token'
    })

    if (result.success) {
      logger.info('Webhook subscription successful', { pageId })
      systemMonitor.log('facebook-webhook', 'Subscription successful', 'info', { pageId })
      
      return NextResponse.json({
        success: true,
        message: 'Webhook subscription successful',
        subscriptionId: result.subscriptionId,
        details: result.details
      })
    } else {
      logger.error('Webhook subscription failed', { pageId, error: result.error })
      systemMonitor.log('facebook-webhook', 'Subscription failed', 'error', { 
        pageId, 
        error: result.error,
        details: result.details
      })
      
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 400 })
    }

  } catch (error) {
    logger.error('Webhook subscription API error', { error: error.message })
    systemMonitor.log('facebook-webhook', 'API error', 'error', { error: error.message })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: 'pageId is required' },
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

    // Unsubscribe from webhook events
    const result = await webhookManager.unsubscribePage(pageId, pageAccessToken)

    if (result.success) {
      logger.info('Webhook unsubscription successful', { pageId })
      systemMonitor.log('facebook-webhook', 'Unsubscription successful', 'info', { pageId })
      
      return NextResponse.json({
        success: true,
        message: 'Webhook unsubscription successful',
        details: result.details
      })
    } else {
      logger.error('Webhook unsubscription failed', { pageId, error: result.error })
      systemMonitor.log('facebook-webhook', 'Unsubscription failed', 'error', { 
        pageId, 
        error: result.error
      })
      
      return NextResponse.json({
        success: false,
        error: result.error,
        details: result.details
      }, { status: 400 })
    }

  } catch (error) {
    logger.error('Webhook unsubscription API error', { error: error.message })
    systemMonitor.log('facebook-webhook', 'API error', 'error', { error: error.message })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
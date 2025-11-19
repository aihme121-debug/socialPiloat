import { NextRequest, NextResponse } from 'next/server'
import { FacebookActionsService } from '@/lib/services/facebook-actions-service'
import { TokenEncryptionService } from '@/lib/services/token-encryption-service'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

const actionsService = new FacebookActionsService()
const encryptionService = new TokenEncryptionService()

export async function GET(request: NextRequest) {
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

    // Get recent posts
    const result = await actionsService.getRecentPosts(pageId, pageAccessToken, 10)

    if (result.success) {
      logger.info('Posts fetched successfully', { pageId, count: result.posts?.length })
      systemMonitor.log('facebook-actions', 'Posts fetched', 'info', { 
        pageId, 
        count: result.posts?.length 
      })
      
      return NextResponse.json({
        success: true,
        posts: result.posts
      })
    } else {
      logger.error('Failed to fetch posts', { pageId, error: result.error })
      systemMonitor.log('facebook-actions', 'Posts fetch failed', 'error', { 
        pageId, 
        error: result.error 
      })
      
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

  } catch (error) {
    logger.error('Get posts API error', { error: error.message })
    systemMonitor.log('facebook-actions', 'API error', 'error', { error: error.message })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pageId, message, link, picture, published = true, scheduledPublishTime } = await request.json()

    // Validate required parameters
    if (!pageId || !message) {
      return NextResponse.json(
        { success: false, error: 'pageId and message are required' },
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

    // Create the post
    const result = await actionsService.createPost({
      pageId,
      pageAccessToken,
      message,
      link,
      picture,
      published,
      scheduledPublishTime
    })

    if (result.success) {
      logger.info('Post created successfully', { pageId, postId: result.postId })
      systemMonitor.log('facebook-actions', 'Post created', 'info', { 
        pageId, 
        postId: result.postId 
      })
      
      return NextResponse.json({
        success: true,
        postId: result.postId,
        details: result.details
      })
    } else {
      logger.error('Failed to create post', { pageId, error: result.error })
      systemMonitor.log('facebook-actions', 'Post creation failed', 'error', { 
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
    logger.error('Create post API error', { error: error.message })
    systemMonitor.log('facebook-actions', 'API error', 'error', { error: error.message })
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
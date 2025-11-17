import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SocialPlatform, ContentStatus } from '@prisma/client'
import { uploadToStorage } from '@/lib/storage'
import { SocialMediaService } from '@/lib/social-media/service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const contentText = formData.get('contentText') as string
    const platforms = JSON.parse(formData.get('platforms') as string) as SocialPlatform[]
    const publishNow = formData.get('publishNow') === 'true'
    const scheduledAt = formData.get('scheduledAt') as string

    if (!contentText?.trim() || !platforms?.length) {
      return NextResponse.json({ message: 'Content and platforms are required' }, { status: 400 })
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { businessId: true }
    })

    if (!user?.businessId) {
      return NextResponse.json({ message: 'No business associated with user' }, { status: 400 })
    }

    // Handle media uploads
    const mediaUrls: string[] = []
    const mediaFiles = formData.getAll('media') as File[]
    
    for (const file of mediaFiles) {
      if (file.size > 0) {
        const url = await uploadToStorage(file, `content/${user.businessId}`)
        mediaUrls.push(url)
      }
    }

    // Create content record
    const content = await prisma.content.create({
      data: {
        contentText,
        mediaUrls,
        contentType: 'post',
        status: publishNow ? ContentStatus.PUBLISHED : ContentStatus.SCHEDULED,
        userId: session.user.id,
        businessId: user.businessId,
        aiMetadata: {
          platforms,
          scheduledAt: scheduledAt || null,
          publishedAt: publishNow ? new Date() : null
        }
      }
    })

    // Get social accounts for selected platforms
    const connectedAccounts = await prisma.socialAccount.findMany({
      where: {
        businessId: user.businessId,
        platform: { in: platforms },
        isActive: true
      }
    })

    if (connectedAccounts.length === 0) {
      return NextResponse.json({ 
        message: 'No connected social accounts found for selected platforms' 
      }, { status: 400 })
    }

    // Create posts for each social account and keep mapping to update later
    const postIdByAccountId: Record<string, string> = {}
    const posts = await Promise.all(
      connectedAccounts.map(async (account) => {
        const post = await prisma.post.create({
          data: {
            platforms: [account.platform],
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            publishedAt: publishNow ? new Date() : null,
            status: publishNow ? 'PUBLISHED' : 'SCHEDULED',
            contentId: content.id,
            userId: session.user.id,
            businessId: user.businessId!,
            socialAccountId: account.id,
            performanceMetrics: {}
          }
        })
        postIdByAccountId[account.id] = post.id
        return post
      })
    )

    // If publishing now, trigger actual posting to social platforms
    if (publishNow) {
      try {
        // Format content for social media service
        const postContent = {
          text: contentText,
          mediaUrls,
          platforms: platforms
        }

        // Convert social accounts to the format expected by SocialMediaService
        const serviceAccounts = connectedAccounts.map(account => ({
          id: account.id,
          platform: account.platform,
          accessToken: account.accessToken,
          accountId: account.accountId,
          accountName: account.accountName,
          settings: account.settings
        }))

        // Post to social platforms
        const postingResults = await SocialMediaService.postContent(postContent, serviceAccounts)

        // Update posts with results (map accountId -> created postId)
        for (const result of postingResults) {
          if (result.success) {
            const postId = postIdByAccountId[result.accountId]
            if (postId) {
              await prisma.post.update({
                where: { id: postId },
                data: {
                  status: 'PUBLISHED',
                  publishedAt: new Date(),
                  performanceMetrics: {
                    postId: result.postId,
                    url: result.url
                  }
                }
              })
            }
          }
        }

        console.log(`Successfully published to ${postingResults.filter(r => r.success).length} platforms`)
      } catch (error) {
        console.error('Error publishing to social platforms:', error)
        // Don't fail the entire request if social posting fails
        // The content is still created and can be retried
      }
    }

    return NextResponse.json({
      message: publishNow ? 'Content published successfully' : 'Content scheduled successfully',
      content,
      posts
    })

  } catch (error) {
    console.error('Content creation error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as ContentStatus
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { businessId: true }
    })

    if (!user?.businessId) {
      return NextResponse.json({ content: [] })
    }

    const whereClause: any = { businessId: user.businessId }
    if (status) {
      whereClause.status = status
    }

    const content = await prisma.content.findMany({
      where: whereClause,
      include: {
        posts: {
          include: {
            socialAccount: true
          }
        },
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    const total = await prisma.content.count({ where: whereClause })

    return NextResponse.json({
      content,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Content fetch error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
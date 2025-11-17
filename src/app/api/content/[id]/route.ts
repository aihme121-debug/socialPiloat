import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get user's business
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { businessId: true }
    })

    if (!user?.businessId) {
      return NextResponse.json({ message: 'No business associated with user' }, { status: 400 })
    }

    // Delete content and associated posts
    const content = await db.content.deleteMany({
      where: {
        id: params.id,
        businessId: user.businessId
      }
    })

    if (content.count === 0) {
      return NextResponse.json({ message: 'Content not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Content deleted successfully' })

  } catch (error) {
    console.error('Delete content error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Get user's business
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { businessId: true }
    })

    if (!user?.businessId) {
      return NextResponse.json({ message: 'No business associated with user' }, { status: 400 })
    }

    // Find content and associated posts
    const content = await db.content.findFirst({
      where: {
        id: params.id,
        businessId: user.businessId,
        status: 'DRAFT'
      },
      include: {
        posts: {
          where: { status: 'DRAFT' }
        }
      }
    })

    if (!content) {
      return NextResponse.json({ message: 'Content not found or not in draft status' }, { status: 404 })
    }

    // Update content and posts to published status
    const updatedContent = await db.content.update({
      where: { id: params.id },
      data: {
        status: 'PUBLISHED',
        aiMetadata: {
          ...(typeof content.aiMetadata === 'object' && content.aiMetadata !== null ? content.aiMetadata : {}),
          publishedAt: new Date()
        }
      }
    })

    // Update all associated posts
    await Promise.all(
      content.posts.map(post =>
        db.post.update({
          where: { id: post.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date()
          }
        })
      )
    )

    return NextResponse.json({
      message: 'Content published successfully',
      content: updatedContent
    })

  } catch (error) {
    console.error('Publish content error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
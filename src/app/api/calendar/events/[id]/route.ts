import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { scheduledAt } = body

    if (!scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 })
    }

    // Get user with business information
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, businessId: true, tenantId: true }
    })

    if (!user?.businessId) {
      return NextResponse.json({ error: 'No business associated' }, { status: 400 })
    }

    // Verify the post belongs to the user's business
    const post = await db.post.findFirst({
      where: {
        id: params.id,
        businessId: user.businessId,
        business: {
          tenantId: user.tenantId
        }
      },
      include: {
        content: true,
        socialAccount: true
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 })
    }

    // Update the scheduled time
    const updatedPost = await db.post.update({
      where: { id: params.id },
      data: {
        scheduledAt: new Date(scheduledAt)
      },
      include: {
        content: true,
        socialAccount: true
      }
    })

    // Return the updated event in the same format as the calendar API
    const event = {
      id: updatedPost.id,
      date: updatedPost.scheduledAt || updatedPost.publishedAt || updatedPost.createdAt,
      title: updatedPost.content.contentText ? updatedPost.content.contentText.slice(0, 60) : 'Scheduled Post',
      status: updatedPost.status,
      platforms: updatedPost.platforms,
      account: updatedPost.socialAccount?.accountName
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Calendar reschedule error:', error)
    return NextResponse.json({ error: 'Failed to reschedule post' }, { status: 500 })
  }
}
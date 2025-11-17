import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    const start = startStr ? new Date(startStr) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const end = endStr ? new Date(endStr) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true }
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 400 })
    }

    const posts = await db.post.findMany({
      where: {
        status: { in: ['SCHEDULED', 'PUBLISHED'] },
        scheduledAt: { gte: start, lte: end },
        business: { tenantId: user.tenantId },
      },
      include: {
        content: true,
        socialAccount: true,
      },
      orderBy: { scheduledAt: 'asc' },
    })

    const events = posts.map((p) => ({
      id: p.id,
      date: p.scheduledAt || p.publishedAt || p.createdAt,
      title: p.content.contentText ? p.content.contentText.slice(0, 60) : 'Scheduled Post',
      status: p.status,
      platforms: p.platforms,
      account: p.socialAccount?.accountName,
    }))

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Calendar events error:', error)
    return NextResponse.json({ events: [] })
  }
}
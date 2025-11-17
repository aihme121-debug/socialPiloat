import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    })

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 })
    }

    // Get Facebook social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        businessId: user.business.id,
        platform: 'FACEBOOK'
      }
    })

    if (socialAccounts.length === 0) {
      return NextResponse.json({ error: 'No Facebook accounts found' }, { status: 404 })
    }

    const account = pageId 
      ? socialAccounts.find(acc => acc.accountId === pageId)
      : socialAccounts[0]

    if (!account?.accessToken) {
      return NextResponse.json({ error: 'No Facebook account with valid access token' }, { status: 404 })
    }

    const url = `https://graph.facebook.com/v18.0/${account.accountId}/conversations?limit=${limit}&access_token=${encodeURIComponent(account.accessToken)}`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Failed to fetch conversations' }, { status: 400 })
    return NextResponse.json({ conversations: data.data || [] })
  } catch (err) {
    console.error('Facebook conversations error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
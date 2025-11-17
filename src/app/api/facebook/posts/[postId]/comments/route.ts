import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPageAccess } from '../../../util'

export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId') || undefined
    const limit = parseInt(searchParams.get('limit') || '25', 10)

    const ctx = await getPageAccess(session.user.id, pageId)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 })

    const fields = 'id,message,created_time,from,like_count,comment_count'
    const url = `https://graph.facebook.com/v18.0/${params.postId}/comments?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(ctx.accessToken as string)}`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Failed to fetch comments' }, { status: 400 })
    return NextResponse.json({ comments: data.data || [] })
  } catch (err) {
    console.error('Facebook comments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { message, pageId } = body
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const ctx = await getPageAccess(session.user.id, pageId)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 })

    const url = `https://graph.facebook.com/v18.0/${params.postId}/comments`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: ctx.accessToken }),
    })
    const data = await res.json()
    if (!res.ok || !data.id) return NextResponse.json({ error: data?.error?.message || 'Failed to post comment' }, { status: 400 })
    return NextResponse.json({ success: true, commentId: data.id })
  } catch (err) {
    console.error('Facebook comment reply error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
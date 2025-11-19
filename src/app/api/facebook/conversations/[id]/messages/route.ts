import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPageAccess } from '../../../util'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId') || undefined

    const ctx = await getPageAccess(session.user.id, pageId)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 })

    const url = `https://graph.facebook.com/v18.0/${params.id}/messages?access_token=${encodeURIComponent(ctx.accessToken as string)}`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok || data.error) {
      return NextResponse.json({ error: data?.error?.message || 'Facebook API error' }, { status: 502 })
    }
    return NextResponse.json({ messages: data.data || [] })
  } catch (err) {
    console.error('Facebook messages error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { message, pageId } = body
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const ctx = await getPageAccess(session.user.id, pageId)
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: 400 })

    // Messenger Send: use Page messages endpoint with recipient
    const sendUrl = `https://graph.facebook.com/v18.0/me/messages?access_token=${encodeURIComponent(ctx.accessToken as string)}`
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { thread_key: params.id },
        message: { text: message },
      }),
    })
    const data = await res.json()
    if (!res.ok || data.error) return NextResponse.json({ error: data?.error?.message || 'Failed to send message' }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Facebook send message error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
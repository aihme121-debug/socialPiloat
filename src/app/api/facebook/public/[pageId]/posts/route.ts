import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5', 10)
    const appId = process.env.FACEBOOK_CLIENT_ID
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET
    if (!appId || !appSecret) return NextResponse.json({ error: 'App credentials missing' }, { status: 400 })
    const appToken = `${appId}|${appSecret}`
    const fields = 'id,message,created_time,permalink_url'
    const url = `https://graph.facebook.com/v18.0/${params.pageId}/posts?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(appToken)}`
    const res = await fetch(url)
    const data = await res.json()
    if (!res.ok) {
      const msg = data?.error?.message || 'Permission required: Page Public Content Access'
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    return NextResponse.json({ posts: data.data || [] })
  } catch (err) {
    console.error('Facebook public posts error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
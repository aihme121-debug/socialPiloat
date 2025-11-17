import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  let token: any = null
  try {
    token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  } catch (_) {
    token = null
  }
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')
  const isPublicPage = ['/about', '/pricing', '/contact'].includes(request.nextUrl.pathname)
  
  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }
  
  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  
  // Add tenant context to headers for multi-tenancy
  if (token?.tenantId) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-id', token.tenantId as string)
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
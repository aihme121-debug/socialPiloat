import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const INSTAGRAM_CONFIG = {
  clientId: process.env.INSTAGRAM_APP_ID,
  clientSecret: process.env.INSTAGRAM_APP_SECRET,
  redirectUri: `${process.env.NEXTAUTH_URL}/api/auth/social/instagram`,
  authUrl: 'https://api.instagram.com/oauth/authorize',
  scope: 'user_profile,user_media'
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Get user and their business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, businessId: true }
    });

    if (!user || !user.businessId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (!INSTAGRAM_CONFIG.clientId) {
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=instagram_not_configured', request.url));
    }

    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      businessId: user.businessId,
      timestamp: Date.now(),
    })).toString('base64');

    // Build authorization URL
    const authUrl = new URL(INSTAGRAM_CONFIG.authUrl);
    authUrl.searchParams.set('client_id', INSTAGRAM_CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', INSTAGRAM_CONFIG.redirectUri);
    authUrl.searchParams.set('scope', INSTAGRAM_CONFIG.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Instagram OAuth:', error);
    return NextResponse.redirect(new URL('/dashboard/social-accounts?error=oauth_init_failed', request.url));
  }
}
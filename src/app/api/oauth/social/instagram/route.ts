import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dynamicOAuthConfig from '@/lib/social-media/oauth-config';

// Get dynamic Instagram configuration
const getInstagramConfig = () => {
  const config = dynamicOAuthConfig.getConfigForProvider('instagram');
  if (!config) {
    throw new Error('Instagram OAuth configuration not available');
  }
  return config;
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

    const instagramConfig = getInstagramConfig();
    
    if (!instagramConfig.clientId) {
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=instagram_not_configured', request.url));
    }

    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
    })).toString('base64');

    // Build authorization URL
    const authUrl = new URL(instagramConfig.authUrl);
    authUrl.searchParams.set('client_id', instagramConfig.clientId);
    authUrl.searchParams.set('redirect_uri', instagramConfig.redirectUri);
    authUrl.searchParams.set('scope', instagramConfig.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Instagram OAuth:', error);
    return NextResponse.redirect(new URL('/dashboard/social-accounts?error=oauth_init_failed', request.url));
  }
}
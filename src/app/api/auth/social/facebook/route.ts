import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dynamicOAuthConfig from '@/lib/social-media/oauth-config';

// Get dynamic Facebook configuration
const getFacebookConfig = () => {
  const config = dynamicOAuthConfig.getConfigForProvider('facebook');
  if (!config) {
    throw new Error('Facebook OAuth configuration not available');
  }
  return config;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const facebookConfig = getFacebookConfig();
    
    if (!facebookConfig.clientId) {
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=facebook_not_configured', request.url));
    }

    // Get user and their business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, businessId: true }
    });

    if (!user || !user.businessId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      businessId: user.businessId,
      timestamp: Date.now(),
    })).toString('base64');

    // Build authorization URL
    const authUrl = new URL(facebookConfig.authUrl);
    authUrl.searchParams.set('client_id', facebookConfig.clientId);
    authUrl.searchParams.set('redirect_uri', facebookConfig.redirectUri);
    authUrl.searchParams.set('scope', facebookConfig.scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating Facebook OAuth:', error);
    return NextResponse.redirect(new URL('/dashboard/social-accounts?error=oauth_init_failed', request.url));
  }
}
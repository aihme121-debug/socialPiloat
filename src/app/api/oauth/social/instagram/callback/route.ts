import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dynamicOAuthConfig from '@/lib/social-media/oauth-config';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    if (error) {
      console.error('Instagram OAuth error:', error);
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=no_authorization_code', request.url));
    }

    const instagramConfig = getInstagramConfig();

    // Exchange authorization code for access token
    const tokenResponse = await fetch(instagramConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: instagramConfig.clientId,
        client_secret: instagramConfig.clientSecret,
        code: code,
        redirect_uri: instagramConfig.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=token_exchange_failed`, request.url));
    }

    const tokenData = await tokenResponse.json();
    const { access_token, user_id, expires_in } = tokenData;

    // Get user profile information
    const profileResponse = await fetch(`https://graph.instagram.com/${user_id}?fields=id,username,account_type`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=profile_fetch_failed', request.url));
    }

    const profileData = await profileResponse.json();

    // Calculate expiration date
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    // Store the social account in database
    try {
      await prisma.socialAccount.upsert({
        where: {
          businessId_platform_accountId: {
            businessId: user.businessId,
            platform: 'INSTAGRAM',
            accountId: profileData.id,
          },
        },
        update: {
          accessToken: access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt: expiresAt,
          accountName: profileData.username,
          settings: { profile: profileData },
          isActive: true,
        },
        create: {
          businessId: user.businessId,
          platform: 'INSTAGRAM',
          accountId: profileData.id,
          accountName: profileData.username,
          accessToken: access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt: expiresAt,
          settings: { profile: profileData },
          isActive: true,
        },
      });

      return NextResponse.redirect(new URL('/dashboard/social-accounts?success=instagram_connected', request.url));
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=database_error', request.url));
    }
  } catch (error) {
    console.error('Error in Instagram OAuth callback:', error);
    return NextResponse.redirect(new URL('/dashboard/social-accounts?error=oauth_callback_failed', request.url));
  }
}
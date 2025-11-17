import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dynamicOAuthConfig from '@/lib/social-media/oauth-config';

export const dynamic = 'force-dynamic';

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
      console.error('Facebook OAuth error:', error);
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=no_authorization_code', request.url));
    }

    const facebookConfig = getFacebookConfig();

    // Exchange authorization code for access token
    const tokenResponse = await fetch(facebookConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: facebookConfig.clientId,
        client_secret: facebookConfig.clientSecret,
        code: code,
        redirect_uri: facebookConfig.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=token_exchange_failed`, request.url));
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    // Get user profile information
    const profileResponse = await fetch('https://graph.facebook.com/me?fields=id,name,email,picture', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!profileResponse.ok) {
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=profile_fetch_failed', request.url));
    }

    const profileData = await profileResponse.json();

    // Get user's Facebook pages
    const pagesResponse = await fetch('https://graph.facebook.com/me/accounts', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    let pages = [];
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();
      pages = pagesData.data || [];
    }

    // Calculate expiration date
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    // Store the social account in database
    try {
      console.log('Storing Facebook account:', {
        businessId: user.businessId,
        platform: 'FACEBOOK',
        accountId: profileData.id,
        accountName: profileData.name,
        hasAccessToken: !!access_token,
        expiresAt: expiresAt,
        pagesCount: pages.length,
      });

      const result = await prisma.socialAccount.upsert({
        where: {
          businessId_platform_accountId: {
            businessId: user.businessId,
            platform: 'FACEBOOK',
            accountId: profileData.id,
          },
        },
        update: {
          accessToken: access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt: expiresAt,
          accountName: profileData.name,
          settings: {
            profile: profileData,
            pages: pages,
          },
          isActive: true,
        },
        create: {
          businessId: user.businessId,
          platform: 'FACEBOOK',
          accountId: profileData.id,
          accountName: profileData.name,
          accessToken: access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresAt: expiresAt,
          settings: {
            profile: profileData,
            pages: pages,
          },
          isActive: true,
        },
      });

      console.log('Facebook account stored successfully:', result.id);
      
      // Use absolute URL for redirect to ensure session persistence
      const redirectUrl = new URL('/dashboard/social-accounts', request.url);
      redirectUrl.searchParams.set('success', 'facebook_connected');
      
      console.log('Redirecting to:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl);
    } catch (dbError) {
      console.error('Database error storing Facebook account:', dbError);
      return NextResponse.redirect(new URL('/dashboard/social-accounts?error=database_error', request.url));
    }
  } catch (error) {
    console.error('Error in Facebook OAuth callback:', error);
    return NextResponse.redirect(new URL('/dashboard/social-accounts?error=oauth_callback_failed', request.url));
  }
}
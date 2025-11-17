import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import dynamicOAuthConfig from '@/lib/social-media/oauth-config';

// Get OAuth configuration using dynamic system
const getOAuthConfig = (provider: string) => {
  const config = dynamicOAuthConfig.getConfigForProvider(provider);
  if (!config) {
    throw new Error(`OAuth configuration not available for provider: ${provider}`);
  }
  return config;
};

export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
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

    const { provider } = params;
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    if (error) {
      console.error(`OAuth error for ${provider}:`, error);
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=${error}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=no_code`, request.url));
    }

    const config = getOAuthConfig(provider);
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=${provider}_not_configured`, request.url));
    }

    // Exchange code for access token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        redirect_uri: config.redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error(`Token exchange failed for ${provider}:`, errorData);
      return NextResponse.redirect(new URL(`/dashboard/social-accounts?error=token_exchange_failed`, request.url));
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    // Get user profile information
    let profileData;
    let accountId;
    let accountName;
    
    if (provider === 'facebook') {
      const profileResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${access_token}`);
      profileData = await profileResponse.json();
      accountId = profileData.id;
      accountName = profileData.name;
    } else if (provider === 'instagram') {
      const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username,account_type&access_token=${access_token}`);
      profileData = await profileResponse.json();
      accountId = profileData.id;
      accountName = profileData.username;
    }

    // Calculate expiration date
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : null;

    // Store or update the social account connection
    await prisma.socialAccount.upsert({
      where: {
        businessId_platform_accountId: {
          businessId: user.businessId,
          platform: provider.toUpperCase() as any,
          accountId: accountId,
        },
      },
      update: {
        accessToken: access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt,
        accountName: accountName,
        settings: profileData ? { profile: profileData } : {},
        isActive: true,
      },
      create: {
        businessId: user.businessId,
        platform: provider.toUpperCase() as any,
        accountId: accountId,
        accountName: accountName,
        accessToken: access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt,
        settings: profileData ? { profile: profileData } : {},
        isActive: true,
      },
    });

    // For Facebook, also get page information if available
    if (provider === 'facebook') {
      try {
        const pagesResponse = await fetch(`https://graph.facebook.com/me/accounts?access_token=${access_token}`);
        const pagesData = await pagesResponse.json();
        
        if (pagesData.data && pagesData.data.length > 0) {
          // Store page information as additional profile data
          const updatedProfileData = {
            ...profileData,
            pages: pagesData.data,
          };
          
          await prisma.socialAccount.update({
            where: {
              businessId_platform_accountId: {
                businessId: user.businessId,
                platform: 'FACEBOOK',
                accountId: accountId,
              },
            },
            data: {
              settings: { profile: updatedProfileData },
            },
          });
        }
      } catch (error) {
        console.error('Error fetching Facebook pages:', error);
      }
    }

    return NextResponse.redirect(new URL('/dashboard/social-accounts?success=true', request.url));
  } catch (error) {
    console.error(`OAuth callback error for ${params.provider}:`, error);
    return NextResponse.redirect(new URL('/dashboard/social-accounts?error=internal_error', request.url));
  }
}
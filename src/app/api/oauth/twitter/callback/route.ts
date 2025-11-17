import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/twitter/callback`,
        code_verifier: state || 'plain'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Twitter token exchange error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to exchange authorization code',
        details: errorData 
      }, { status: tokenResponse.status });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user information from Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Twitter user information');
    }

    const twitterUser = await userResponse.json();
    const twitterUserData = twitterUser.data;

    // Check if account already exists
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        businessId: user.business.id,
        platform: 'TWITTER',
        accountId: twitterUserData.id
      }
    });

    if (existingAccount) {
      // Update existing account
      await prisma.socialAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
          accountName: twitterUserData.name,


          settings: {
            ...existingAccount.settings as object,
            lastSync: new Date().toISOString(),
            followersCount: 0, // Will be updated later
            followingCount: 0, // Will be updated later
            tweetCount: 0, // Will be updated later
  
            profileImageUrl: twitterUserData.profile_image_url
          }
        }
      });
    } else {
      // Create new account
      await prisma.socialAccount.create({
        data: {
          businessId: user.business.id,
          platform: 'TWITTER',
          accountId: twitterUserData.id,
          accountName: twitterUserData.name,

          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
          settings: {
            followersCount: 0,
            followingCount: 0,
            tweetCount: 0,
            verified: false,
            createdAt: new Date().toISOString()
          }
        }
      });
    }

    // Redirect to social accounts page
    return NextResponse.redirect(new URL('/dashboard/social-accounts', request.url));

  } catch (error) {
    console.error('Twitter OAuth callback error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during Twitter authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
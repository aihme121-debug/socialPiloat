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
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || ''
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LinkedIn token exchange error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to exchange authorization code',
        details: errorData 
      }, { status: tokenResponse.status });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    // Get user profile from LinkedIn
    const profileResponse = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch LinkedIn profile');
    }

    const profileData = await profileResponse.json();

    // Get email address
    const emailResponse = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    let email = '';
    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      email = emailData.elements?.[0]?.['handle~']?.emailAddress || '';
    }

    // Check if account already exists
    const existingAccount = await prisma.socialAccount.findFirst({
      where: {
        businessId: user.business.id,
        platform: 'LINKEDIN',
        accountId: profileData.id
      }
    });

    const profileImageUrl = profileData.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier || '';
    const fullName = `${profileData.localizedFirstName} ${profileData.localizedLastName}`;

    if (existingAccount) {
      // Update existing account
      await prisma.socialAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: access_token,
          expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
          accountName: fullName,

          settings: {
            ...existingAccount.settings as object,
              lastSync: new Date().toISOString(),
              firstName: profileData.localizedFirstName,
              lastName: profileData.localizedLastName,
              email: email,
              profileImageUrl: profileImageUrl
          }
        }
      });
    } else {
      // Create new account
      await prisma.socialAccount.create({
        data: {
          businessId: user.business.id,
          platform: 'LINKEDIN',
          accountId: profileData.id,
          accountName: fullName,

          accessToken: access_token,
          expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
          settings: {
            firstName: profileData.localizedFirstName,
            lastName: profileData.localizedLastName,
            email: email,
            profileImageUrl: profileImageUrl,
            createdAt: new Date().toISOString(),
            lastSync: new Date().toISOString()
          }
        }
      });
    }

    // Redirect to social accounts page
    return NextResponse.redirect(new URL('/dashboard/social-accounts', request.url));

  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during LinkedIn authentication',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
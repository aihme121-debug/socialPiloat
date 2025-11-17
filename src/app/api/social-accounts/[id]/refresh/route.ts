import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refreshFacebookToken } from '@/lib/social-media/facebook';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with business data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { businessId: true }
    });

    if (!user?.businessId) {
      return NextResponse.json({ error: 'No business associated' }, { status: 400 });
    }

    // Verify the account belongs to the user's business
    const account = await prisma.socialAccount.findFirst({
      where: { 
        id: params.id,
        businessId: user.businessId 
      }
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Refresh token based on platform
    let updatedAccount = account;
    
  if (account.platform === 'FACEBOOK') {
    try {
      const refreshResult = await refreshFacebookToken(account.refreshToken || '');
      
      if (refreshResult.success && refreshResult.accessToken) {
        updatedAccount = await prisma.socialAccount.update({
          where: { id: params.id },
          data: {
            accessToken: refreshResult.accessToken,
            expiresAt: refreshResult.expiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
            settings: {
              ...(account.settings as any),
              lastRefreshed: new Date().toISOString()
            }
          }
        });
      }
      const currentSettings: any = updatedAccount.settings || {}
      const pages: any[] = Array.isArray(currentSettings.pages) ? currentSettings.pages : []
      if (pages.length > 0) {
        const enriched = await Promise.all(
          pages.map(async (pg: any) => {
            try {
              const resp = await fetch(`https://graph.facebook.com/v18.0/${pg.id}?fields=name,fan_count,followers_count,category,category_list,link,picture&access_token=${encodeURIComponent(pg.access_token || updatedAccount.accessToken)}`)
              const info = await resp.json()
              return { ...pg, ...info }
            } catch (_) {
              return pg
            }
          })
        )
        updatedAccount = await prisma.socialAccount.update({
          where: { id: params.id },
          data: {
            settings: {
              ...currentSettings,
              pages: enriched,
              lastRefreshed: new Date().toISOString()
            }
          }
        })
      }
    } catch (refreshError) {
      console.error('Facebook token refresh failed:', refreshError);
      return NextResponse.json({ error: 'Failed to refresh token' }, { status: 400 });
    }
  }

    return NextResponse.json({ 
      success: true,
      account: {
        id: updatedAccount.id,
        platform: updatedAccount.platform,
        username: updatedAccount.accountName,
        profileData: updatedAccount.settings,
        isActive: updatedAccount.isActive,
        connectedAt: updatedAccount.connectedAt,
        expiresAt: updatedAccount.expiresAt,
      }
    });

  } catch (error) {
    console.error('Refresh account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
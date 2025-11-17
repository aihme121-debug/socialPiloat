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

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    // Get LinkedIn social accounts
    const linkedinAccounts = await prisma.socialAccount.findMany({
      where: {
        businessId: user.business.id,
        platform: 'LINKEDIN'
      }
    });

    if (linkedinAccounts.length === 0) {
      return NextResponse.json({ error: 'No LinkedIn accounts found' }, { status: 404 });
    }

    const results = [];

    for (const account of linkedinAccounts) {
      if (!account.accessToken) {
        continue;
      }

      try {
        // Get user profile
        const profileResponse = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))', {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });

        let profileData = null;
        if (profileResponse.ok) {
          profileData = await profileResponse.json();
        }

        // Get posts (shares) from LinkedIn
        const postsResponse = await fetch(`https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${account.accountId})&projection=(id,created,specificContent,visibility)`, {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });

        let posts = [];
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          posts = postsData.elements?.map((post: any) => ({
            id: post.id,
            createdAt: post.created?.time || new Date().toISOString(),
            content: post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '',
            visibility: post.visibility?.['com.linkedin.ugc.MemberNetworkVisibility'] || 'PUBLIC',
            media: post.specificContent?.['com.linkedin.ugc.ShareContent']?.media || []
          })) || [];
        }

        // Get network stats (followers, connections)
        const networkResponse = await fetch('https://api.linkedin.com/v2/connections/urn:li:person:me/networkinfo', {
          headers: {
            'Authorization': `Bearer ${account.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        });

        let networkStats = { followers: 0, connections: 0 };
        if (networkResponse.ok) {
          const networkData = await networkResponse.json();
          networkStats = {
            followers: networkData.firstDegreeSize || 0,
            connections: networkData.firstDegreeSize || 0
          };
        }

        // Update account with latest data
        if (profileData) {
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: {
              settings: {
                ...account.settings as object,
                firstName: profileData.localizedFirstName,
                lastName: profileData.localizedLastName,
                profileImageUrl: profileData.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier || '',
                followers: networkStats.followers,
                connections: networkStats.connections,
                lastSync: new Date().toISOString()
              }
            }
          });
        }

        results.push({
          account: {
            id: account.id,
            name: account.accountName,
            firstName: profileData?.localizedFirstName || '',
            lastName: profileData?.localizedLastName || '',
            profileImageUrl: profileData?.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier || (account.settings as any)?.profileImageUrl || '',
            platformId: account.accountId,
            followers: networkStats.followers,
            connections: networkStats.connections
          },
          posts: posts.map((post: any) => ({
            ...post,
            engagement: {
              likes: 0, // LinkedIn API v2 doesn't provide engagement metrics directly
              comments: 0,
              shares: 0,
              impressions: 0
            },
            engagementRate: '0.00'
          })),
          summary: {
            totalPosts: posts.length,
            averageEngagement: '0.00'
          }
        });

      } catch (error) {
        console.error(`Error processing LinkedIn account ${account.id}:`, error);
        continue;
      }
    }

    return NextResponse.json({ 
      accounts: results,
      totalAccounts: results.length
    });

  } catch (error) {
    console.error('Error fetching LinkedIn data:', error);
    return NextResponse.json({ error: 'Failed to fetch LinkedIn data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, accountId, visibility = 'PUBLIC' } = await request.json();

    if (!content || !accountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user's business and verify account ownership
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        businessId: user.business.id,
        platform: 'LINKEDIN'
      }
    });

    if (!account?.accessToken) {
      return NextResponse.json({ error: 'LinkedIn account not found or not authorized' }, { status: 404 });
    }

    // Create LinkedIn post
    const postData = {
      author: `urn:li:person:${account.accountId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility
      }
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('LinkedIn API error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to post on LinkedIn',
        details: errorData 
      }, { status: response.status });
    }

    const result = await response.json();

    // Create content first
    const contentRecord = await prisma.content.create({
      data: {
        contentType: 'post',
        contentText: content,
        mediaUrls: [],
        userId: user.id,
        businessId: user.business.id
      }
    });

    // Store in database
    const post = await prisma.post.create({
      data: {
        businessId: user.business.id,
        platforms: ['LINKEDIN'],
        contentId: contentRecord.id,
        userId: user.id,
        socialAccountId: account.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        performanceMetrics: {
          accountId: account.id,
          visibility: visibility,
          platformPostId: result.id,
          author: account.accountId
        }
      }
    });

    return NextResponse.json({
      success: true,
      post: result,
      postId: post.id
    });

  } catch (error) {
    console.error('Error posting on LinkedIn:', error);
    return NextResponse.json({ error: 'Failed to post on LinkedIn' }, { status: 500 });
  }
}
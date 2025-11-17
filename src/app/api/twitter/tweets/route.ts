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

    // Get Twitter social accounts
    const twitterAccounts = await prisma.socialAccount.findMany({
      where: {
        businessId: user.business.id,
        platform: 'TWITTER'
      }
    });

    if (twitterAccounts.length === 0) {
      return NextResponse.json({ error: 'No Twitter accounts found' }, { status: 404 });
    }

    const results = [];

    for (const account of twitterAccounts) {
      if (!account.accessToken) {
        continue;
      }

      try {
        // Get user tweets - need to get the Twitter user ID from settings or use accountId
        const twitterUserId = account.accountId; // Assuming accountId contains the Twitter user ID
        const tweetsResponse = await fetch(
          `https://api.twitter.com/2/users/${twitterUserId}/tweets?max_results=10&tweet.fields=created_at,public_metrics,context_annotations,attachments,lang&expansions=attachments.media_keys&media.fields=url,preview_image_url`,
          {
            headers: {
              'Authorization': `Bearer ${account.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!tweetsResponse.ok) {
          console.error(`Failed to fetch tweets for account ${account.id}:`, tweetsResponse.status);
          continue;
        }

        const tweetsData = await tweetsResponse.json();

        // Get user profile info
        const userResponse = await fetch(
          `https://api.twitter.com/2/users/${twitterUserId}?user.fields=public_metrics,verified,description,location,url,profile_image_url`,
          {
            headers: {
              'Authorization': `Bearer ${account.accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        let userData = null;
        if (userResponse.ok) {
          userData = await userResponse.json();
        }

        // Process tweets with engagement metrics
        const tweets = tweetsData.data?.map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          metrics: {
            retweets: tweet.public_metrics?.retweet_count || 0,
            likes: tweet.public_metrics?.like_count || 0,
            replies: tweet.public_metrics?.reply_count || 0,
            quotes: tweet.public_metrics?.quote_count || 0,
            impressions: tweet.public_metrics?.impression_count || 0
          },
          engagementRate: tweet.public_metrics?.impression_count 
            ? ((tweet.public_metrics.like_count + tweet.public_metrics.retweet_count + tweet.public_metrics.reply_count) / tweet.public_metrics.impression_count * 100).toFixed(2)
            : '0.00',
          media: tweet.attachments?.media_keys?.map((key: string) => 
            tweetsData.includes?.media?.find((m: any) => m.media_key === key)
          ).filter(Boolean) || [],
          language: tweet.lang,
          context: tweet.context_annotations
        })) || [];

        // Update account with latest metrics
        if (userData?.data) {
          await prisma.socialAccount.update({
            where: { id: account.id },
            data: {
              settings: {
                ...account.settings as object,
                followersCount: userData.data.public_metrics?.followers_count || 0,
                followingCount: userData.data.public_metrics?.following_count || 0,
                tweetCount: userData.data.public_metrics?.tweet_count || 0,
                verified: userData.data.verified || false,
                description: userData.data.description,
                location: userData.data.location,
                url: userData.data.url,
                lastSync: new Date().toISOString()
              }
            }
          });
        }

        results.push({
          account: {
            id: account.id,
            name: account.accountName,
            username: (account.settings as any)?.username || '',
            profileImageUrl: (account.settings as any)?.profileImageUrl || '',
            platformId: account.accountId,
            followers: userData?.data?.public_metrics?.followers_count || 0,
            following: userData?.data?.public_metrics?.following_count || 0,
            tweetCount: userData?.data?.public_metrics?.tweet_count || 0,
            verified: userData?.data?.verified || false
          },
          tweets,
          summary: {
            totalTweets: tweets.length,
            totalEngagement: tweets.reduce((sum: number, tweet: any) => 
              sum + tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies, 0),
            averageEngagement: tweets.length > 0 
              ? (tweets.reduce((sum: number, tweet: any) => 
                  sum + tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies, 0) / tweets.length).toFixed(2)
              : '0.00'
          }
        });

      } catch (error) {
        console.error(`Error processing Twitter account ${account.id}:`, error);
        continue;
      }
    }

    return NextResponse.json({ 
      accounts: results,
      totalAccounts: results.length
    });

  } catch (error) {
    console.error('Error fetching Twitter data:', error);
    return NextResponse.json({ error: 'Failed to fetch Twitter data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, accountId, mediaIds = [] } = await request.json();

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
        platform: 'TWITTER'
      }
    });

    if (!account?.accessToken) {
      return NextResponse.json({ error: 'Twitter account not found or not authorized' }, { status: 404 });
    }

    // Post tweet
    const tweetData: any = {
      text: content
    };

    if (mediaIds.length > 0) {
      tweetData.media = {
        media_ids: mediaIds
      };
    }

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tweetData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Twitter API error:', errorData);
      return NextResponse.json({ 
        error: 'Failed to post tweet',
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
        platforms: ['TWITTER'],
        contentId: contentRecord.id,
        userId: user.id,
        socialAccountId: account.id,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        performanceMetrics: {
          mediaIds,
          accountId: account.id,
          tweetId: result.data.id,
          text: result.data.text
        }
      }
    });

    return NextResponse.json({
      success: true,
      tweet: result.data,
      postId: post.id
    });

  } catch (error) {
    console.error('Error posting tweet:', error);
    return NextResponse.json({ error: 'Failed to post tweet' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FacebookService } from '@/lib/services/facebook-service';
import { apiHandler, ValidationError, AuthenticationError, ExternalServiceError } from '@/lib/error-handling/error-handler';
import { logger } from '@/lib/logging/logger-service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id && !session?.user?.email) {
    throw new AuthenticationError('Authentication required to access dashboard analytics');
  }

    // Get user with business and social accounts data
    const user = await prisma.user.findUnique({
      where: session.user.email ? { email: session.user.email } : { id: session.user.id },
      include: { 
        business: {
          include: {
            socialAccounts: {
              where: { isActive: true },
              select: {
                id: true,
                platform: true,
                accountId: true,
                accessToken: true,
                expiresAt: true,
                settings: true
              }
            }
          }
        }
      }
    });

    if (!user?.business) {
      throw new ValidationError('No business associated with user account');
    }

    const businessId = user.business.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch social media analytics from connected accounts
    const socialAnalytics = await fetchSocialMediaAnalytics(user.business.socialAccounts, thirtyDaysAgo, now);
    
    // Fetch local database metrics
    const [
      totalPosts,
      scheduledPosts,
      publishedPosts,
      socialAccountsCount,
      recentPosts
    ] = await Promise.all([
      // Total posts created
      prisma.post.count({
        where: { 
          businessId: businessId,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      
      // Scheduled posts
      prisma.post.count({
        where: { 
          businessId: businessId,
          status: 'SCHEDULED',
          scheduledAt: { gte: now }
        }
      }),
      
      // Published posts
      prisma.post.count({
        where: { 
          businessId: businessId,
          status: 'PUBLISHED',
          publishedAt: { gte: thirtyDaysAgo }
        }
      }),
      
      // Connected social accounts
      prisma.socialAccount.count({
        where: { 
          businessId: businessId,
          isActive: true 
        }
      }),
      
      // Recent posts (last 5)
      prisma.post.findMany({
        where: { businessId: businessId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          content: true
        }
      })
    ]);

    // Calculate combined metrics
    const totalFollowers = socialAnalytics.totalFollowers;
    const totalEngagement = socialAnalytics.totalEngagement;
    const totalReach = socialAnalytics.totalReach;
    const engagementRate = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(1) : '0.0';
    
    // Calculate follower growth
    const followerGrowth = calculateGrowthRate(socialAnalytics.followerHistory);

    // Format recent activity
    const recentActivity = recentPosts.map(post => ({
      id: post.id,
      type: post.content?.contentType || 'post',
      content: post.content?.contentText?.substring(0, 100) + '...' || 'No content',
      platform: post.platforms[0] || 'Unknown',
      status: post.status,
      createdAt: post.createdAt,
      metrics: post.performanceMetrics || getPostMetrics(post.id, socialAnalytics.postAnalytics)
    }));

    const response = {
      metrics: {
        totalPosts,
        scheduledPosts,
        publishedPosts,
        socialAccounts: socialAccountsCount,
        engagementRate: parseFloat(engagementRate),
        totalFollowers,
        followerGrowth: followerGrowth.toFixed(1),
        totalReach,
        totalEngagement
      },
      recentActivity,
      platformDistribution: socialAnalytics.platformDistribution,
      followerGrowth: socialAnalytics.followerHistory,
      topPosts: socialAnalytics.topPosts,
      timeRange: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString()
      }
    };

  console.log('Dashboard analytics response:', JSON.stringify(response, null, 2));
  return NextResponse.json(response);
});

async function fetchSocialMediaAnalytics(socialAccounts: any[], startDate: Date, endDate: Date) {
  const facebookService = new FacebookService();
  let totalFollowers = 0;
  let totalEngagement = 0;
  let totalReach = 0;
  const platformDistribution: Record<string, number> = {};
  const followerHistory: any[] = [];
  const postAnalytics: any[] = [];
  const topPosts: any[] = [];

  for (const account of socialAccounts) {
    try {
      if (account.platform === 'FACEBOOK' || account.platform === 'INSTAGRAM') {
        // Check if token is expired
        if (account.expiresAt && new Date(account.expiresAt) < new Date()) {
          console.log(`Token expired for ${account.platform} account ${account.id}`);
          continue;
        }

        const analytics = await facebookService.getAccountAnalytics(
          account.accountId,
          account.accessToken,
          startDate,
          endDate
        );

        totalFollowers += analytics.followers || 0;
        totalEngagement += analytics.totalEngagement || 0;
        totalReach += analytics.totalReach || 0;
        
        // Update platform distribution
        platformDistribution[account.platform] = (platformDistribution[account.platform] || 0) + 1;
        
        // Add to follower history
        if (analytics.followerHistory) {
          followerHistory.push(...analytics.followerHistory);
        }
        
        // Add post analytics
        if (analytics.posts) {
          postAnalytics.push(...analytics.posts);
        }
        
        // Add top posts
        if (analytics.topPosts) {
          topPosts.push(...analytics.topPosts);
        }
      }
    } catch (error) {
      console.error(`Error fetching analytics for ${account.platform} account ${account.id}:`, error);
      // Log to monitoring service but continue with other accounts
      logger.error(
        'External service error fetching social media analytics',
        error instanceof Error ? error : undefined,
        {
          platform: account.platform,
          accountId: account.id,
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      );
      // Continue with other accounts even if one fails
    }
  }

  // Sort and limit top posts
  const sortedTopPosts = topPosts
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 5);

  // Aggregate follower history by date
  const aggregatedFollowerHistory = aggregateFollowerHistory(followerHistory);

  return {
    totalFollowers,
    totalEngagement,
    totalReach,
    platformDistribution,
    followerHistory: aggregatedFollowerHistory,
    postAnalytics,
    topPosts: sortedTopPosts
  };
}

function aggregateFollowerHistory(history: any[]): any[] {
  const aggregated: Record<string, number> = {};
  
  history.forEach(item => {
    const date = new Date(item.date).toISOString().split('T')[0];
    aggregated[date] = (aggregated[date] || 0) + (item.followers || 0);
  });

  return Object.entries(aggregated)
    .map(([date, followers]) => ({ date, followers }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function calculateGrowthRate(followerHistory: any[]): number {
  if (followerHistory.length < 2) return 0;
  
  const first = followerHistory[0].followers;
  const last = followerHistory[followerHistory.length - 1].followers;
  
  return first > 0 ? ((last - first) / first) * 100 : 0;
}

function getPostMetrics(postId: string, postAnalytics: any[]): any {
  const post = postAnalytics.find(p => p.id === postId);
  return post ? {
    likes: post.likes || 0,
    comments: post.comments || 0,
    shares: post.shares || 0,
    views: post.views || 0
  } : {};
}
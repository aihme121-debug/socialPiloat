import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SocialPlatform } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with business data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, businessId: true }
    });

    if (!user?.businessId) {
      return NextResponse.json({ error: 'No business associated' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    const dateFilter: any = {};
    
    // Get user's business
    const business = await prisma.business.findUnique({
      where: { id: user.businessId }
    });
    
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Platform filter
    const platformFilter: any = { businessId: user.businessId };
    if (platform) {
      platformFilter.platform = platform;
    }
    if (Object.keys(dateFilter).length > 0) {
      platformFilter.postedAt = dateFilter;
    }

    // Fetch analytics data
    const [
      postsByPlatform,
      engagementByDate,
      topPerformingPosts,
      accountGrowth,
      recentComments,
      engagementMetrics
    ] = await Promise.all([
      // Posts by platform - simplified approach since platforms is an array
      prisma.post.findMany({
        where: {
          businessId: user.businessId,
          ...(platform && { platforms: { has: platform as SocialPlatform } }),
          ...(Object.keys(dateFilter).length > 0 && {
            publishedAt: dateFilter
          })
        },
        select: {
          platforms: true
        }
      }).then(posts => {
        // Manual grouping since platforms is an array
        const platformCounts: Record<string, number> = {};
        posts.forEach(post => {
          post.platforms.forEach(p => {
            platformCounts[p] = (platformCounts[p] || 0) + 1;
          });
        });
        return Object.entries(platformCounts).map(([platform, count]) => ({
          platforms: platform,
          _count: { id: count }
        }));
      }),

      // Engagement by date (last 30 days) - use analytics table
      prisma.analytics.findMany({
        where: {
          businessId: user.businessId,
          ...(platform && { platform: platform as SocialPlatform }),
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          },
          metric: { in: ['ENGAGEMENT', 'REACH', 'IMPRESSIONS'] }
        },
        select: {
          date: true,
          platform: true,
          value: true,
          metric: true
        },
        orderBy: { date: 'asc' }
      }),

      // Top performing posts - based on performance metrics
      prisma.post.findMany({
        where: {
          businessId: user.businessId,
          ...(platform && { platforms: { has: platform as SocialPlatform } }),
          ...(Object.keys(dateFilter).length > 0 && {
            publishedAt: dateFilter
          })
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          content: {
            select: {
              contentText: true,
              contentType: true
            }
          }
        }
      }),

      // Account growth (mock data - would need real API calls)
      Promise.resolve([
        { date: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), followers: 1200, following: 500 },
        { date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), followers: 1210, following: 505 },
        { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), followers: 1225, following: 510 },
        { date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), followers: 1240, following: 515 },
        { date: new Date(), followers: 1260, following: 520 }
      ]),

      // Recent comments (mock data)
      Promise.resolve([
        {
          id: '1',
          platform: 'FACEBOOK',
          content: 'Great post! Really helpful content.',
          author: 'John Doe',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          postId: 'post123'
        },
        {
          id: '2',
          platform: 'INSTAGRAM',
          content: 'Love this! 👍',
          author: 'Jane Smith',
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          postId: 'post456'
        }
      ]),

      // Engagement metrics summary - use analytics
      prisma.analytics.aggregate({
        where: {
          businessId: user.businessId,
          ...(platform && { platform: platform as SocialPlatform }),
          ...(Object.keys(dateFilter).length > 0 && {
            date: dateFilter
          }),
          metric: { in: ['ENGAGEMENT', 'REACH', 'IMPRESSIONS'] }
        },
        _sum: {
          value: true
        },
        _avg: {
          value: true
        },
        _count: {
          id: true
        }
      })
    ]);

    // Process engagement by date
    const engagementByDateMap = new Map();
    engagementByDate.forEach(analyticsItem => {
      const dateKey = analyticsItem.date.toISOString().split('T')[0];
      if (!engagementByDateMap.has(dateKey)) {
        engagementByDateMap.set(dateKey, {
          date: dateKey,
          totalEngagement: 0,
          totalReach: 0,
          posts: 0,
          platforms: new Set()
        });
      }
      
      const dayData = engagementByDateMap.get(dateKey);
      if (analyticsItem.metric === 'ENGAGEMENT') {
        dayData.totalEngagement += analyticsItem.value;
      } else if (analyticsItem.metric === 'REACH') {
        dayData.totalReach += analyticsItem.value;
      }
      dayData.platforms.add(analyticsItem.platform || 'Unknown');
    });

    const engagementByDateFormatted = Array.from(engagementByDateMap.values()).map(day => ({
      date: day.date,
      engagement: day.totalEngagement,
      reach: day.totalReach,
      posts: day.posts,
      platforms: Array.from(day.platforms)
    }));

    // Format top performing posts
    const topPosts = topPerformingPosts.map(post => ({
      id: post.id,
      platform: post.platforms[0] || 'Unknown',
      content: post.content?.contentText?.substring(0, 100) + '...' || 'No content',
      engagement: post.performanceMetrics || {},
      postedAt: post.publishedAt,
      performanceScore: calculatePerformanceScore(post.performanceMetrics as any)
    }));

    // Process posts by platform (flatten the platforms array)
    const platformStats: Record<string, number> = {};
    postsByPlatform.forEach(item => {
      if (item.platforms && Array.isArray(item.platforms)) {
        item.platforms.forEach(platform => {
          platformStats[platform] = (platformStats[platform] || 0) + item._count.id;
        });
      }
    });

    const response = {
      overview: {
        totalPosts: engagementMetrics._count.id || 0,
        totalEngagement: engagementMetrics._sum?.value || 0,
        averageEngagement: engagementMetrics._avg?.value || 0,
        engagementRate: calculateOverallEngagementRate(engagementByDate)
      },
      postsByPlatform: Object.entries(platformStats).map(([platform, count]) => ({
        platform,
        count,
        totalEngagement: engagementByDate
          .filter(item => item.platform === platform && item.metric === 'ENGAGEMENT')
          .reduce((sum, item) => sum + item.value, 0)
      })),
      engagementByDate: engagementByDateFormatted,
      topPerformingPosts: topPosts,
      accountGrowth: accountGrowth.map(item => ({
        date: item.date.toISOString().split('T')[0],
        followers: item.followers,
        following: item.following
      })),
      recentComments,
      dateRange: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString()
      }
    };

    console.log('Analytics data response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);

  } catch (error) {
    console.error('Analytics data error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculatePerformanceScore(metrics: any): number {
  if (!metrics) return 0;
  const likes = metrics.likes || 0;
  const comments = metrics.comments || 0;
  const shares = metrics.shares || 0;
  const reach = metrics.reach || 1;
  
  // Simple performance score: weighted engagement rate
  return ((likes * 1 + comments * 2 + shares * 3) / reach) * 100;
}

function calculateOverallEngagementRate(engagementData: any[]): number {
  if (engagementData.length === 0) return 0;
  
  const totalEngagement = engagementData.reduce((sum, day) => sum + day.totalEngagement, 0);
  const totalReach = engagementData.reduce((sum, day) => sum + day.totalReach, 0);
  
  return totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
}

function extractTotalEngagement(metrics: any): number {
  if (!metrics) return 0;
  const likes = metrics.likes || 0;
  const comments = metrics.comments || 0;
  const shares = metrics.shares || 0;
  return likes + comments + shares;
}
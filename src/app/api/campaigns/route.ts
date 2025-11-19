import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CampaignStatus } from '@prisma/client';

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Filter campaigns through content business relation
    const campaignsWithContent = await prisma.content.findMany({
      where: {
        businessId: user.business.id
      },
      select: {
        campaignId: true
      },
      distinct: ['campaignId']
    });

    const campaignIds = campaignsWithContent.map(c => c.campaignId).filter(Boolean);

    const whereClause: any = {
      id: { in: campaignIds }
    };

    if (status && status !== 'all') {
      whereClause.status = status as CampaignStatus;
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      include: {
        content: {
          select: {
            id: true,
            contentType: true,
            status: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            content: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });

    const total = await prisma.campaign.count({
      where: whereClause
    });

    // Calculate campaign metrics
    const campaignsWithMetrics = campaigns.map(campaign => {
      const content = campaign.content;
      const totalPosts = content.length;
      const publishedPosts = content.filter(c => c.status === 'PUBLISHED').length;
      const scheduledPosts = content.filter(c => c.status === 'SCHEDULED').length;
      const totalEngagement = content.reduce((sum, item) => {
        // Content doesn't have engagement field, so we'll use 0 for now
        return sum + 0;
      }, 0);

      return {
        ...campaign,
        metrics: {
          totalPosts,
          publishedPosts,
          scheduledPosts,
          totalEngagement,
          averageEngagement: totalPosts > 0 ? (totalEngagement / totalPosts).toFixed(2) : '0.00'
        }
      };
    });

    return NextResponse.json({
      campaigns: campaignsWithMetrics,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const {
      name,
      description,
      objective,
      budget,
      startDate,
      endDate,
      platforms,
      targetAudience,
      contentStrategy
    } = await request.json();

    // Validate required fields
    if (!name || !objective || !platforms || platforms.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, objective, and platforms are required' 
      }, { status: 400 });
    }

    // Create campaign with proper data structure
    const campaign = await prisma.campaign.create({
      data: {
        name,
        objectives: {
          description: description || '',
          objective: objective,
          platforms: platforms,
          targetAudience: targetAudience || {},
          contentStrategy: contentStrategy || {}
        },
        budget: budget ? { amount: parseFloat(budget) } : {},
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.DRAFT
      }
    });

    // Create initial content for the campaign
    const campaignContent = await prisma.content.create({
      data: {
        contentType: 'campaign',
        contentText: `Campaign: ${name}`,
        mediaUrls: [],
        userId: user.id,
        businessId: user.business.id,
        campaignId: campaign.id
      }
    });

    return NextResponse.json({
      success: true,
      campaign
    });

  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
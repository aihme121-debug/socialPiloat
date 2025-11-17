import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { CampaignStatus } from '@prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's business
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const campaign = await db.campaign.findFirst({
      where: {
        id: params.id,
        content: {
          some: {
            businessId: user.business.id
          }
        }
      },
      include: {
        content: {
          select: {
            id: true,
            contentType: true,
            contentText: true,
            mediaUrls: true,
            status: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Calculate campaign metrics
    const content = campaign.content;
    const totalPosts = content.length;
    const publishedPosts = content.filter(c => c.status === 'PUBLISHED').length;
    const scheduledPosts = content.filter(c => c.status === 'SCHEDULED').length;
    const totalEngagement = content.reduce((sum, item) => {
      // Content doesn't have engagement field, so we'll use 0 for now
      return sum + 0;
    }, 0);

    const campaignWithMetrics = {
      ...campaign,
      metrics: {
        totalPosts,
        publishedPosts,
        scheduledPosts,
        totalEngagement,
        averageEngagement: totalPosts > 0 ? (totalEngagement / totalPosts).toFixed(2) : '0.00'
      }
    };

    return NextResponse.json({
      campaign: campaignWithMetrics,
      content: campaign.content
    });

  } catch (error) {
    console.error('Error fetching campaign:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's business
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const campaign = await db.campaign.updateMany({
      where: {
        id: params.id,
        content: {
          some: {
            businessId: user.business.id
          }
        }
      },
      data: {
        status: status as CampaignStatus,
        updatedAt: new Date()
      }
    });

    if (campaign.count === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Campaign ${status}`
    });

  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}
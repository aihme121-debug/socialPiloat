import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/ai/usage - Get AI usage analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    // Check if user has access to this business
    const businessAccess = await db.business.findFirst({
      where: {
        id: businessId,
        tenantId: user.tenantId,
      },
    });

    if (!businessAccess) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check if user belongs to this business
    const userBusiness = await db.user.findFirst({
      where: {
        id: user.id,
        businessId: businessId,
      },
    });

    if (!userBusiness) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Mock analytics data for now
    const analytics = {
      summary: {
        totalUsage: 125,
        totalCost: 0.85,
        totalTokens: 12500,
        averageCostPerUsage: 0.0068,
        averageTokensPerUsage: 100,
      },
      usageByType: {
        CONTENT_GENERATION: 80,
        REPLY_GENERATION: 45,
      },
      usageByPlatform: {
        FACEBOOK: 50,
        INSTAGRAM: 40,
        WHATSAPP: 35,
      },
      usageByModel: {
        'gpt-4': 75,
        'gpt-3.5-turbo': 50,
      },
      dailyTrend: [
        { date: '2024-01-01', count: 5 },
        { date: '2024-01-02', count: 8 },
        { date: '2024-01-03', count: 12 },
        { date: '2024-01-04', count: 15 },
        { date: '2024-01-05', count: 10 },
      ],
      topUsers: [
        { userId: '1', name: 'John Doe', email: 'john@example.com', usage: 45, cost: 0.32 },
        { userId: '2', name: 'Jane Smith', email: 'jane@example.com', usage: 38, cost: 0.28 },
        { userId: '3', name: 'Bob Johnson', email: 'bob@example.com', usage: 42, cost: 0.25 },
      ],
      recentUsage: [
        { id: '1', operation: 'CONTENT_GENERATION', cost: 0.01, tokens: 100, createdAt: new Date() },
        { id: '2', operation: 'REPLY_GENERATION', cost: 0.005, tokens: 50, createdAt: new Date(Date.now() - 3600000) },
      ],
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching AI usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
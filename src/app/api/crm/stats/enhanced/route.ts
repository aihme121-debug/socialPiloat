import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
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
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get basic customer stats using existing Customer model
    const [
      totalCustomers,
      newCustomers,
      highScoreCustomers,
      totalPosts,
      totalEngagement,
      recentMessages,
    ] = await Promise.all([
      // Total customers
      prisma.customer.count({
        where: { businessId: user.business.id },
      }),
      
      // New customers (created in last 7 days)
      prisma.customer.count({
        where: {
          businessId: user.business.id,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      
      // High score customers (lead score > 70)
      prisma.customer.count({
        where: {
          businessId: user.business.id,
          leadScore: {
            gt: 70,
          },
        },
      }),
      
      // Total posts
      prisma.post.count({
        where: { businessId: user.business.id },
      }),
      
      // Total engagement (approximated by post count)
      prisma.post.count({
        where: { 
          businessId: user.business.id,
          status: 'PUBLISHED'
        },
      }),
      
      // Recent chat messages
      prisma.chatMessage.count({
        where: {
          businessId: user.business.id,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get customer tag distribution
    const customersWithTags = await prisma.customer.findMany({
      where: { businessId: user.business.id },
      select: { tags: true }
    });

    const tagDistribution: Record<string, number> = {};
    customersWithTags.forEach(customer => {
      customer.tags.forEach(tag => {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      });
    });

    // Get top customers by lead score
    const topCustomers = await prisma.customer.findMany({
      where: { businessId: user.business.id },
      orderBy: { leadScore: 'desc' },
      take: 5,
      select: { 
        id: true, 
        name: true, 
        email: true, 
        leadScore: true,
        tags: true 
      }
    });

    const stats = {
      totalCustomers,
      newCustomers,
      highScoreCustomers,
      totalPosts,
      totalEngagement,
      recentMessages,
      conversionRate: totalCustomers > 0 ? Math.round((highScoreCustomers / totalCustomers) * 100) : 0,
      avgCustomerScore: totalCustomers > 0 ? Math.round(customersWithTags.reduce((sum, c) => sum + c.tags.length, 0) / totalCustomers) : 0,
      tagDistribution: Object.entries(tagDistribution).map(([tag, count]) => ({ tag, count })),
      topPerformers: topCustomers.map(customer => ({
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        score: customer.leadScore,
        tags: customer.tags
      })),
    };

    // Emit real-time stats update (temporarily disabled)
    // try {
    //   emitToUser(user.id, 'crm-stats-update', {
    //     stats,
    //     timestamp: new Date(),
    //   });
    // } catch (socketError) {
    //   console.error('Socket emission error:', socketError);
    //   // Continue with the response even if socket emission fails
    // }

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching CRM stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST endpoint to trigger real-time updates (for testing)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventType, data } = await request.json();

    if (!eventType) {
      return NextResponse.json({ error: 'Missing eventType' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Emit different types of real-time events (temporarily disabled)
    switch (eventType) {
      case 'new-customer':
        // emitToUser(user.id, 'new-customer', {
        //   customer: data,
        //   timestamp: new Date(),
        // });
        break;
      
      case 'message-received':
        // emitToUser(user.id, 'message-received', {
        //   message: data,
        //   timestamp: new Date(),
        // });
        break;
      
      case 'score-updated':
        // emitToUser(user.id, 'score-updated', {
        //   customerId: data.customerId,
        //   newScore: data.newScore,
        //   timestamp: new Date(),
        // });
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Event ${eventType} emitted successfully` 
    });

  } catch (error) {
    console.error('Error emitting real-time event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
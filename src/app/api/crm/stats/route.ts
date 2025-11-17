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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Error fetching CRM stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '1');

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get high-value customers (treating them as opportunities) with pagination
    const opportunities = await prisma.customer.findMany({
      where: { 
        businessId: user.business.id,
        leadScore: {
          gte: 50 // High-value customers with lead score >= 50
        }
      },
      orderBy: { leadScore: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({ opportunities });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, phone, notes, tags, socialProfiles, leadScore } = body;

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Create high-value customer (treating as opportunity)
    const opportunity = await prisma.customer.create({
      data: {
        businessId: user.business.id,
        name,
        email,
        phone,
        notes: notes || '',
        tags: tags || ['opportunity', 'high-value'],
        socialProfiles: socialProfiles || {},
        leadScore: leadScore || 75, // Default high score for opportunities
        lastInteraction: new Date(),
      }
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error('Error creating opportunity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
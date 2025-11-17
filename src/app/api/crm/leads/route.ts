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

    // Get customers (treating them as leads) with pagination
    const customers = await prisma.customer.findMany({
      where: { businessId: user.business.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
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
    const { name, email, phone, notes, tags, socialProfiles } = body;

    // Get user's business
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { business: true }
    });

    if (!user?.business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Calculate initial lead score based on available data
    const initialScore = calculateCustomerScore({
      name,
      email,
      phone,
      socialProfiles: socialProfiles || {}
    });

    // Create customer (treating as lead)
    const customer = await prisma.customer.create({
      data: {
        businessId: user.business.id,
        name,
        email,
        phone,
        notes: notes || '',
        tags: tags || [],
        socialProfiles: socialProfiles || {},
        leadScore: initialScore,
        lastInteraction: new Date(),
      }
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to calculate customer score
function calculateCustomerScore(customerData: any): number {
  let score = 0;

  // Contact info scoring
  if (customerData.email) score += 20;
  if (customerData.phone) score += 15;
  if (customerData.name && customerData.name.length > 2) score += 10;

  // Social profiles scoring
  const socialProfiles = customerData.socialProfiles || {};
  if (socialProfiles.facebook) score += 10;
  if (socialProfiles.linkedin) score += 15;
  if (socialProfiles.twitter) score += 5;

  return Math.min(score, 100); // Cap at 100
}
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    console.log('Social accounts API: Starting request...');
    
    // Get session
    const session = await getServerSession(authOptions);
    console.log('Session data:', JSON.stringify(session, null, 2));
    
    if (!session?.user) {
      console.log('No session found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with business data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, businessId: true }
    });

    console.log('User data:', JSON.stringify(user, null, 2));

    if (!user?.businessId) {
      console.log('No business ID found for user');
      return NextResponse.json({ error: 'No business associated' }, { status: 400 });
    }

    // Fetch social accounts for the business
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { 
        businessId: user.businessId,
        isActive: true 
      },
      orderBy: { connectedAt: 'desc' }
    });

    console.log('Found social accounts:', JSON.stringify(socialAccounts, null, 2));

    // Format accounts for frontend
    const formattedAccounts = socialAccounts.map(account => ({
      id: account.id,
      platform: account.platform,
      accountId: account.accountId,
      accountName: account.accountName,
      username: account.accountName,
      profileData: account.settings,
      isActive: account.isActive,
      connectedAt: account.connectedAt,
      expiresAt: account.expiresAt,
    }));

    console.log('Formatted accounts:', JSON.stringify(formattedAccounts, null, 2));

    return NextResponse.json({ 
      accounts: formattedAccounts,
      businessId: user.businessId 
    });

  } catch (error) {
    console.error('Social accounts API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
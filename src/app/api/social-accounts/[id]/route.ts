import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with business data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { businessId: true }
    });

    if (!user?.businessId) {
      return NextResponse.json({ error: 'No business associated' }, { status: 400 });
    }

    // Verify the account belongs to the user's business
    const account = await prisma.socialAccount.findFirst({
      where: { 
        id: params.id,
        businessId: user.businessId 
      }
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Deactivate the account instead of deleting
    await prisma.socialAccount.update({
      where: { id: params.id },
      data: { 
        isActive: false,
        settings: {
          ...(account.settings as any),
          disconnectedAt: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Disconnect account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
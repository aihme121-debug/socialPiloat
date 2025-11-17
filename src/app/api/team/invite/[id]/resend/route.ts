import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasRole } from '@/lib/rbac'
import { UserRole } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with tenant
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { tenant: true }
    });

    if (!user?.tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    // Require role TEAM_MANAGER or higher
    if (!hasRole(user.role as UserRole, 'TEAM_MANAGER' as UserRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Find the invitation
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: params.id }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json({ error: 'Invitation is not pending' }, { status: 400 });
    }

    // Generate new token and extend expiration
    const crypto = require('crypto')
    const newToken = crypto.randomBytes(32).toString('hex')
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

    // Resend the invitation
    const resentInvitation = await prisma.teamInvitation.update({
      where: { id: params.id },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        resentAt: new Date()
      }
    });

    // Here you would typically send an email with the new invitation link
    // For now, we'll return the new token for testing
    const invitationUrl = `${process.env.NEXTAUTH_URL}/auth/invite?token=${newToken}`

    console.log(`Team invitation resent: ${invitationUrl}`)

    return NextResponse.json({
      success: true,
      invitation: {
        id: resentInvitation.id,
        email: resentInvitation.email,
        name: resentInvitation.name,
        role: resentInvitation.role,
        status: resentInvitation.status,
        expiresAt: resentInvitation.expiresAt,
        invitationUrl
      }
    });

  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to resend invitation' }, 
      { status: 500 }
    );
  }
}
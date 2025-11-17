import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to invite team members
    if (!['TENANT_ADMIN', 'ORGANIZATION_ADMIN', 'TEAM_MANAGER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { email, role, name } = body

    if (!email || !role || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['VIEWER', 'ANALYST', 'CONTENT_CREATOR', 'SOCIAL_MEDIA_MANAGER', 'TEAM_MANAGER']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Get user's business/tenant info
    const inviter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        tenantId: true, 
        businessId: true,
        email: true,
        name: true 
      }
    })

    if (!inviter?.tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    // Check if invitation already exists
    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: { 
        email, 
        tenantId: inviter.tenantId,
        status: 'PENDING'
      }
    })

    if (existingInvitation) {
      return NextResponse.json({ error: 'Invitation already sent' }, { status: 409 })
    }

    // Generate invitation token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create invitation
    const invitation = await prisma.teamInvitation.create({
      data: {
        email,
        name,
        role,
        token,
        expiresAt,
        tenantId: inviter.tenantId,
        businessId: inviter.businessId,
        invitedBy: session.user.id,
        status: 'PENDING'
      }
    })

    // Here you would typically send an email with the invitation link
    // For now, we'll return the token for testing
    const invitationUrl = `${process.env.NEXTAUTH_URL}/auth/invite?token=${token}`

    console.log(`Team invitation created: ${invitationUrl}`)

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        invitationUrl
      }
    })

  } catch (error: any) {
    console.error('Team invitation error:', error)
    // Handle Prisma known errors more gracefully
    const code = error?.code
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Invitation conflict' }, { status: 409 })
    }
    if (code === 'P2003') {
      return NextResponse.json({ error: 'Invalid relation data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'

    // Get user's tenant info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true }
    })

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 400 })
    }

    // Check permissions
    if (!['TENANT_ADMIN', 'ORGANIZATION_ADMIN', 'TEAM_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build where clause
    const whereClause: any = { tenantId: user.tenantId }
    if (status !== 'all') {
      whereClause.status = status.toUpperCase()
    }

    let invitations = [] as any[]
    try {
      invitations = await prisma.teamInvitation.findMany({
        where: whereClause,
        include: {
          invitedByUser: {
            select: { name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    } catch (err) {
      console.error('Prisma invitations query failed:', err)
      invitations = []
    }

    return NextResponse.json({ invitations })

  } catch (error) {
    console.error('Get team invitations error:', error)
    return NextResponse.json({ invitations: [] })
  }
}
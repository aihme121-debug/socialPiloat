import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user with tenant information
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true }
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }
    
    const businesses = await prisma.business.findMany({
      where: {
        tenantId: user.tenantId,
      },
      include: {
        _count: {
          select: {
            users: true,
            socialAccounts: true,
            posts: true,
            customers: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    
    return NextResponse.json({ businesses })
    
  } catch (error) {
    console.error('Error fetching businesses:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user with tenant information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, tenantId: true }
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }
    
    const body = await request.json()
    const { name, description, industry, size, website, logo } = body
    
    if (!name) {
      return NextResponse.json(
        { message: 'Business name is required' },
        { status: 400 }
      )
    }
    
    const business = await prisma.business.create({
      data: {
        name,
        description,
        industry,
        size,
        website,
        logo,
        tenantId: user.tenantId,
        settings: {
          timezone: 'UTC',
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
        },
      },
    })
    
    return NextResponse.json({ business })
    
  } catch (error) {
    console.error('Error creating business:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
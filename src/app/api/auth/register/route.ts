import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
export const runtime = 'nodejs'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  tenantName: z.string().min(2, 'Organization name must be at least 2 characters'),
  subdomain: z.string().min(2, 'Subdomain must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
})

export async function POST(request: NextRequest) {
  try {
    console.log('[Register] Received request')
    const body = await request.json()
    console.log('[Register] Body:', JSON.stringify(body, null, 2))
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    console.log('[Register] Validated data:', validatedData)
    
    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    })
    console.log('[Register] Existing user check:', existingUser)
    
    if (existingUser) {
      return NextResponse.json(
        { message: 'Email already registered' },
        { status: 400 }
      )
    }
    
    // Check if subdomain already exists
    const existingTenant = await db.tenant.findUnique({
      where: { subdomain: validatedData.subdomain },
    })
    console.log('[Register] Existing tenant check:', existingTenant)
    
    if (existingTenant) {
      return NextResponse.json(
        { message: 'Subdomain already taken' },
        { status: 400 }
      )
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12)
    console.log('[Register] Starting transaction...')
    
    // Create tenant and user in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: validatedData.tenantName,
          subdomain: validatedData.subdomain,
          planType: 'free',
          settings: {
            timezone: 'UTC',
            language: 'en',
            dateFormat: 'MM/DD/YYYY',
          },
        },
      })
      console.log('[Register] Tenant created:', tenant)
      
      // Create a default business for the tenant
      const business = await tx.business.create({
        data: {
          name: validatedData.tenantName,
          tenantId: tenant.id,
          timezone: 'UTC',
          settings: {},
        },
      })
      console.log('[Register] Business created:', business)
      
      // Create user
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          passwordHash,
          name: validatedData.name,
          role: 'TENANT_ADMIN',
          tenantId: tenant.id,
          businessId: business.id,
        },
      })
      console.log('[Register] User created:', user)
      
      return { tenant, user, business }
    })
    console.log('[Register] Transaction complete')
    
    return NextResponse.json({
      message: 'Registration successful',
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        tenantId: result.user.tenantId,
        businessId: result.user.businessId,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
      },
      business: {
        id: result.business.id,
        name: result.business.name,
      },
    })
    
  } catch (error) {
    console.error('[Register] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[])?.[0] ?? 'field'
        const message = target.includes('email')
          ? 'Email already registered'
          : target.includes('subdomain')
          ? 'Subdomain already taken'
          : 'Duplicate value'
        return NextResponse.json({ message }, { status: 400 })
      }
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
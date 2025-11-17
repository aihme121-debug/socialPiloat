import NextAuth from 'next-auth'
import { UserRole } from '@/lib/auth-types'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      businessId?: string | null
      tenantId: string
    }
    accessToken?: string
    provider?: string
    providerAccountId?: string
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role: UserRole
    businessId?: string | null
    tenantId: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    businessId?: string | null
    email?: string
    accessToken?: string
    provider?: string
    providerAccountId?: string
  }
}
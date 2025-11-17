import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (process.platform === 'win32' && process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  delete process.env.PRISMA_QUERY_ENGINE_LIBRARY
}

const dbUrl = process.env.DATABASE_URL
if (dbUrl && /supabase\.com/.test(dbUrl) && !/sslmode=/.test(dbUrl)) {
  if (dbUrl.includes('?')) {
    process.env.DATABASE_URL = `${dbUrl}&sslmode=require`
  } else {
    process.env.DATABASE_URL = `${dbUrl}?sslmode=require`
  }
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
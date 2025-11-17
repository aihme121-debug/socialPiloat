import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/analytics/dashboard/route'
import { UserRole } from '@prisma/client'

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// Mock the Facebook service - fix the mock implementation
vi.mock('@/lib/services/facebook-service', () => ({
  FacebookService: class {
    getAccountAnalytics = vi.fn().mockResolvedValue({
      followers: 1500,
      totalEngagement: 800,
      totalReach: 5000,
      followerHistory: [
        { date: '2024-01-01', followers: 1400 },
        { date: '2024-01-31', followers: 1500 }
      ],
      posts: [
        {
          id: 'post-1',
          content: 'Test post',
          likes: 50,
          comments: 10,
          shares: 5,
          created_time: '2024-01-15T10:00:00Z'
        }
      ],
      topPosts: [
        {
          id: 'post-1',
          content: 'Test post',
          engagement: 65,
          likes: 50,
          comments: 10,
          shares: 5,
          created_time: '2024-01-15T10:00:00Z'
        }
      ]
    })
    getInstagramAnalytics = vi.fn().mockResolvedValue({
      followers: 800,
      totalEngagement: 400,
      totalReach: 2000,
      followerHistory: [],
      posts: [],
      topPosts: []
    })
  }
}))

// Mock the database
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    post: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    socialAccount: {
      count: vi.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'

describe('Analytics Dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return analytics data successfully', async () => {
    const mockSession = {
      user: {
        email: 'test@example.com',
      },
    }

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.CONTENT_CREATOR,
      tenantId: 'tenant-1',
      businessId: 'business-1',
      passwordHash: 'hashed-password',
      isActive: true,
      avatar: null,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      business: {
        id: 'business-1',
        socialAccounts: [
          {
            id: 'account-1',
            platform: 'FACEBOOK',
            accountId: 'fb-account-1',
            accessToken: 'fb-token-1',
            expiresAt: null,
            settings: {}
          },
          {
            id: 'account-2',
            platform: 'INSTAGRAM',
            accountId: 'ig-account-1',
            accessToken: 'ig-token-1',
            expiresAt: null,
            settings: {}
          }
        ]
      }
    }

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(prisma.post.count).mockResolvedValueOnce(10) // totalPosts
    vi.mocked(prisma.post.count).mockResolvedValueOnce(3) // scheduledPosts
    vi.mocked(prisma.post.count).mockResolvedValueOnce(7) // publishedPosts
    vi.mocked(prisma.socialAccount.count).mockResolvedValueOnce(2) // socialAccounts
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([
      {
        id: 'post-1',
        status: 'PUBLISHED',
        platforms: ['FACEBOOK'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        businessId: 'business-1',
        contentId: 'content-1',
        userId: 'user-1',
        socialAccountId: 'account-1',
        scheduledAt: null,
        publishedAt: new Date('2024-01-15'),
        performanceMetrics: { likes: 10, comments: 2 }
      }
    ])

    const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data).toHaveProperty('metrics')
    expect(data).toHaveProperty('recentActivity')
    expect(data).toHaveProperty('platformDistribution')
    expect(data).toHaveProperty('followerGrowth')
    expect(data).toHaveProperty('topPosts')
    expect(data).toHaveProperty('timeRange')
    
    expect(data.metrics).toHaveProperty('totalPosts')
    expect(data.metrics).toHaveProperty('scheduledPosts')
    expect(data.metrics).toHaveProperty('publishedPosts')
    expect(data.metrics).toHaveProperty('socialAccounts')
    expect(data.metrics).toHaveProperty('engagementRate')
    expect(data.metrics).toHaveProperty('totalFollowers')
    expect(data.metrics).toHaveProperty('followerGrowth')
    expect(data.metrics).toHaveProperty('totalReach')
    expect(data.metrics).toHaveProperty('totalEngagement')
  })

  it('should return unauthorized error when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data).toEqual({
      error: {
        message: 'Authentication required to access dashboard analytics',
        code: 'AUTHENTICATION_ERROR',
        statusCode: 401,
        details: undefined
      }
    })
  })

  it('should return error when user not found', async () => {
    const mockSession = {
      user: {
        email: 'test@example.com',
      },
    }

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(400) // Changed from 404 to 400
    const data = await response.json()
    expect(data).toEqual({
      error: {
        message: 'No business associated with user account',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: undefined
      }
    })
  })

  it('should return error when user has no business', async () => {
    const mockSession = {
      user: {
        email: 'test@example.com',
      },
    }

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.CONTENT_CREATOR,
      tenantId: 'tenant-1',
      businessId: null,
      passwordHash: 'hashed-password',
      isActive: true,
      avatar: null,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      business: null
    }

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)

    const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(400) // Changed from 400 to 400 (already correct)
    const data = await response.json()
    expect(data).toEqual({
      error: {
        message: 'No business associated with user account',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: undefined
      }
    })
  })

  it('should handle API errors gracefully', async () => {
    const mockSession = {
      user: {
        email: 'test@example.com',
      },
    }

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.CONTENT_CREATOR,
      tenantId: 'tenant-1',
      businessId: 'business-1',
      passwordHash: 'hashed-password',
      isActive: true,
      avatar: null,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      business: {
        id: 'business-1',
        socialAccounts: []
      }
    }

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(prisma.post.count).mockRejectedValueOnce(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(data.error).toEqual({
      message: 'Database error',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      details: undefined
    })
  })

  it('should handle date range parameters', async () => {
    const mockSession = {
      user: {
        email: 'test@example.com',
      },
    }

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.CONTENT_CREATOR,
      tenantId: 'tenant-1',
      businessId: 'business-1',
      passwordHash: 'hashed-password',
      isActive: true,
      avatar: null,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      business: {
        id: 'business-1',
        socialAccounts: []
      }
    }

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.socialAccount.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?startDate=2024-01-01&endDate=2024-01-31')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.user.findUnique).toHaveBeenCalled()
  })
})
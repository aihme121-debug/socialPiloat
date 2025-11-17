import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/calendar/events/route'
import { PATCH } from '@/app/api/calendar/events/[id]/route'
import { UserRole, PostStatus, SocialPlatform } from '@prisma/client'

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

describe('Calendar Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/calendar/events', () => {
    it('should return calendar events successfully', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
        },
      }

      const mockUser = {
        id: 'user-1',
        tenantId: 'tenant-1',
        businessId: 'business-1',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.CONTENT_CREATOR,
        passwordHash: 'hashed-password',
        isActive: true,
        avatar: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: null
      }

      const mockPosts = [
        {
          id: 'post-1',
          userId: 'user-1',
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          publishedAt: null,
          createdAt: new Date('2024-01-10T10:00:00Z'),
          updatedAt: new Date('2024-01-10T10:00:00Z'),
          status: PostStatus.SCHEDULED,
          platforms: [SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM],
          businessId: 'business-1',
          performanceMetrics: {},
          contentId: 'content-1',
          socialAccountId: 'account-1',
          content: {
            contentText: 'Test post content',
          },
          socialAccount: {
            accountName: 'Test Account',
          },
        },
        {
          id: 'post-2',
          userId: 'user-1',
          scheduledAt: new Date('2024-01-16T14:00:00Z'),
          publishedAt: new Date('2024-01-16T14:00:00Z'),
          createdAt: new Date('2024-01-12T14:00:00Z'),
          updatedAt: new Date('2024-01-12T14:00:00Z'),
          status: PostStatus.PUBLISHED,
          platforms: [SocialPlatform.TWITTER],
          businessId: 'business-1',
          performanceMetrics: {},
          contentId: 'content-2',
          socialAccountId: 'account-2',
          content: {
            contentText: 'Another test post',
          },
          socialAccount: {
            accountName: 'Twitter Account',
          },
        },
      ]

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser)
      vi.mocked(db.post.findMany).mockResolvedValueOnce(mockPosts)

      const request = new NextRequest('http://localhost:3000/api/calendar/events?start=2024-01-01&end=2024-01-31')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data).toHaveProperty('events')
      expect(data.events).toHaveLength(2)
      expect(data.events[0]).toHaveProperty('id')
      expect(data.events[0]).toHaveProperty('date')
      expect(data.events[0]).toHaveProperty('title')
      expect(data.events[0]).toHaveProperty('status')
      expect(data.events[0]).toHaveProperty('platforms')
      expect(data.events[0]).toHaveProperty('account')
    })

    it('should return unauthorized error when no session', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/calendar/events')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should return error when user has no tenant', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
        },
      }

      const mockUser = {
        id: 'user-1',
        tenantId: null,
        businessId: 'business-1',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.CONTENT_CREATOR,
        passwordHash: 'hashed-password',
        isActive: true,
        avatar: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser)

      const request = new NextRequest('http://localhost:3000/api/calendar/events')
      const response = await GET(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({ error: 'No tenant associated' })
    })

    it('should handle date range parameters', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
        },
      }

      const mockUser = {
        id: 'user-1',
        tenantId: 'tenant-1',
        businessId: 'business-1',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.CONTENT_CREATOR,
        passwordHash: 'hashed-password',
        isActive: true,
        avatar: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: null
      }

      const mockPosts: any[] = []

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser)
      vi.mocked(db.post.findMany).mockResolvedValueOnce(mockPosts)

      const request = new NextRequest('http://localhost:3000/api/calendar/events?start=2024-01-01&end=2024-01-31')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(vi.mocked(db.post.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledAt: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-31'),
            },
          }),
        })
      )
    })

    it('should handle API errors gracefully', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
        },
      }

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/calendar/events')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({ events: [] })
    })
  })

  describe('PATCH /api/calendar/events/[id]', () => {
    it('should reschedule post successfully', async () => {
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
      }

      const mockPost = {
        id: 'post-1',
        userId: 'user-1',
        scheduledAt: new Date('2024-01-15T10:00:00Z'),
        publishedAt: null,
        createdAt: new Date('2024-01-10T10:00:00Z'),
        updatedAt: new Date('2024-01-10T10:00:00Z'),
        status: PostStatus.SCHEDULED,
        platforms: [SocialPlatform.FACEBOOK],
        businessId: 'business-1',
        performanceMetrics: {},
        contentId: 'content-1',
        socialAccountId: 'account-1',
        content: {
          contentText: 'Test post content',
        },
        socialAccount: {
          accountName: 'Test Account',
        },
      }

      const updatedPost = {
        ...mockPost,
        scheduledAt: new Date('2024-01-20T15:00:00Z'),
        updatedAt: new Date('2024-01-20T15:00:00Z'),
      }

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser)
      vi.mocked(db.post.findFirst).mockResolvedValueOnce(mockPost)
      vi.mocked(db.post.update).mockResolvedValueOnce(updatedPost)

      const request = new NextRequest('http://localhost:3000/api/calendar/events/post-1', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduledAt: '2024-01-20T15:00:00Z',
        }),
      })

      const response = await PATCH(request, { params: { id: 'post-1' } })

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data).toHaveProperty('event')
      expect(data.event).toHaveProperty('id')
      expect(data.event).toHaveProperty('date')
      expect(data.event).toHaveProperty('title')
      expect(data.event).toHaveProperty('status')
      expect(data.event).toHaveProperty('platforms')
      expect(data.event).toHaveProperty('account')
    })

    it('should return unauthorized error when no session', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/calendar/events/post-1', {
        method: 'PATCH',
        body: JSON.stringify({
          scheduledAt: '2024-01-20T15:00:00Z',
        }),
      })

      const response = await PATCH(request, { params: { id: 'post-1' } })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should return error when scheduledAt is missing', async () => {
      const mockSession = {
        user: {
          email: 'test@example.com',
        },
      }

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)

      const request = new NextRequest('http://localhost:3000/api/calendar/events/post-1', {
        method: 'PATCH',
        body: JSON.stringify({}),
      })

      const response = await PATCH(request, { params: { id: 'post-1' } })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({ error: 'scheduledAt is required' })
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
      }

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser)

      const request = new NextRequest('http://localhost:3000/api/calendar/events/post-1', {
        method: 'PATCH',
        body: JSON.stringify({
          scheduledAt: '2024-01-20T15:00:00Z',
        }),
      })

      const response = await PATCH(request, { params: { id: 'post-1' } })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({ error: 'No business associated' })
    })

    it('should return not found error when post not found', async () => {
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
      }

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(mockUser)
      vi.mocked(db.post.findFirst).mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/calendar/events/post-1', {
        method: 'PATCH',
        body: JSON.stringify({
          scheduledAt: '2024-01-20T15:00:00Z',
        }),
      })

      const response = await PATCH(request, { params: { id: 'post-1' } })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toEqual({ error: 'Post not found or access denied' })
    })

    it('should handle API errors gracefully', async () => {
      const mockSession = {
        user: {
          email: 'test@example.com',
        },
      }

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession)
      vi.mocked(db.user.findUnique).mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/calendar/events/post-1', {
        method: 'PATCH',
        body: JSON.stringify({
          scheduledAt: '2024-01-20T15:00:00Z',
        }),
      })

      const response = await PATCH(request, { params: { id: 'post-1' } })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to reschedule post' })
    })
  })
})
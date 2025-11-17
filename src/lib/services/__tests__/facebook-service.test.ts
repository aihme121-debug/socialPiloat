import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FacebookService } from '@/lib/services/facebook-service'

// Mock fetch
global.fetch = vi.fn()

describe('FacebookService', () => {
  let facebookService: FacebookService
  const mockAccessToken = 'test-access-token'
  const mockAccountId = 'test-account-id'

  beforeEach(() => {
    facebookService = new FacebookService()
    vi.clearAllMocks()
  })

  describe('getAccountAnalytics', () => {
    it('should fetch and return analytics data successfully', async () => {
      // Mock successful API responses for the three API calls
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          json: async () => ({
            data: [
              {
                name: 'page_impressions',
                values: [{ value: 1000 }]
              },
              {
                name: 'page_impressions_unique',
                values: [{ value: 800 }]
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({
            data: [
              {
                id: 'post-1',
                message: 'Test post',
                created_time: '2024-01-15T10:00:00Z',
                likes: { summary: { total_count: 500 } },
                comments: { summary: { total_count: 200 } },
                shares: { count: 100 }
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ fan_count: 1000 })
        } as Response)

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await facebookService.getAccountAnalytics(
        mockAccountId,
        mockAccessToken,
        startDate,
        endDate
      )

      expect(result).toBeDefined()
      expect(result.followers).toBe(1000)
      expect(result.totalEngagement).toBe(800) // 500 likes + 200 comments + 100 shares
      expect(result.totalReach).toBe(1000) // from page_impressions
      expect(result.posts).toHaveLength(1)
      expect(result.topPosts).toHaveLength(1)
      expect(result.followerHistory).toBeDefined()
      expect(result.followerHistory.length).toBeGreaterThan(0)
    })

    it('should handle API errors gracefully', async () => {
      // Mock API error for first call, then empty responses for others
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          json: async () => ({ error: { message: 'API Error' } })
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ data: [] })
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ fan_count: 0 })
        } as Response)

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await facebookService.getAccountAnalytics(
        mockAccountId,
        mockAccessToken,
        startDate,
        endDate
      )

      // Should return default values when API fails
      expect(result).toBeDefined()
      expect(result.followers).toBe(0)
      expect(result.totalEngagement).toBe(0)
      expect(result.totalReach).toBe(0)
      expect(result.posts).toHaveLength(0)
      expect(result.topPosts).toHaveLength(0)
      expect(result.followerHistory).toBeDefined()
    })

    it('should handle network errors', async () => {
      // Mock network error for first call, then empty responses for others
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          json: async () => ({ data: [] })
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ fan_count: 0 })
        } as Response)

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await facebookService.getAccountAnalytics(
        mockAccountId,
        mockAccessToken,
        startDate,
        endDate
      )

      // Should return default values when network fails
      expect(result).toBeDefined()
      expect(result.followers).toBe(0)
      expect(result.totalEngagement).toBe(0)
      expect(result.totalReach).toBe(0)
      expect(result.posts).toHaveLength(0)
      expect(result.topPosts).toHaveLength(0)
      expect(result.followerHistory).toBeDefined()
    })
  })

  describe('getInstagramAnalytics', () => {
    it('should fetch and return Instagram analytics data successfully', async () => {
      // Mock successful API responses for the three API calls
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          json: async () => ({
            data: [
              {
                name: 'impressions',
                values: [{ value: 1200 }]
              },
              {
                name: 'reach',
                values: [{ value: 900 }]
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({
            data: [
              {
                id: 'media-1',
                caption: 'Test Instagram post',
                timestamp: '2024-01-15T10:00:00Z',
                like_count: 600,
                comments_count: 250
              }
            ]
          })
        } as Response)
        .mockResolvedValueOnce({
          json: async () => ({ followers_count: 1200 })
        } as Response)

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      const result = await facebookService.getInstagramAnalytics(
        mockAccountId,
        mockAccessToken,
        startDate,
        endDate
      )

      expect(result).toBeDefined()
      expect(result.followers).toBe(1200)
      expect(result.totalEngagement).toBe(850) // 600 likes + 250 comments
      expect(result.totalReach).toBe(1200) // from impressions
      expect(result.posts).toHaveLength(1)
      expect(result.topPosts).toHaveLength(1)
      expect(result.followerHistory).toBeDefined()
    })
  })

  describe('validateToken', () => {
    it('should return true for valid token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        json: async () => ({ id: 'test-user-id' })
      } as Response)

      const result = await facebookService.validateToken(mockAccessToken)

      expect(result).toBe(true)
    })

    it('should return false for invalid token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        json: async () => ({ error: { message: 'Invalid token' } })
      } as Response)

      const result = await facebookService.validateToken(mockAccessToken)

      expect(result).toBe(false)
    })

    it('should return false for network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      const result = await facebookService.validateToken(mockAccessToken)

      expect(result).toBe(false)
    })
  })

  describe('refreshToken', () => {
    it('should return null as refresh is not implemented', async () => {
      const mockRefreshToken = 'test-refresh-token'

      const result = await facebookService.refreshToken(mockRefreshToken)

      expect(result).toBeNull()
    })
  })
})
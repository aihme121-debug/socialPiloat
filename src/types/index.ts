export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Business {
  id: string
  name: string
  description?: string
  logo?: string
  website?: string
  industry?: string
  size?: BusinessSize
  timezone: string
  settings: BusinessSettings
  createdAt: Date
  updatedAt: Date
}

export interface BusinessSettings {
  socialMedia: {
    facebook?: SocialAccount
    instagram?: SocialAccount
    twitter?: SocialAccount
    linkedin?: SocialAccount
    tiktok?: SocialAccount
    youtube?: SocialAccount
    pinterest?: SocialAccount
  }
  aiSettings: {
    tone: 'professional' | 'casual' | 'friendly' | 'formal'
    language: string
    contentLength: 'short' | 'medium' | 'long'
    includeHashtags: boolean
    autoSchedule: boolean
  }
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
}

export interface SocialAccount {
  id: string
  platform: SocialPlatform
  accountId: string
  accountName: string
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  isActive: boolean
  settings: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Post {
  id: string
  content: string
  platforms: SocialPlatform[]
  mediaUrls?: string[]
  scheduledAt?: Date
  publishedAt?: Date
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  performance?: PostPerformance
  createdBy: string
  businessId: string
  createdAt: Date
  updatedAt: Date
}

export interface PostPerformance {
  likes: number
  comments: number
  shares: number
  reach: number
  impressions: number
  engagementRate: number
}

export interface ChatMessage {
  id: string
  platform: SocialPlatform
  accountId: string
  messageId: string
  senderId: string
  senderName: string
  content: string
  mediaUrls?: string[]
  timestamp: Date
  isRead: boolean
  isReplied: boolean
  businessId: string
  createdAt: Date
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  avatar?: string
  socialProfiles: Record<SocialPlatform, string>
  tags: string[]
  notes: string
  leadScore: number
  lastInteraction?: Date
  businessId: string
  createdAt: Date
  updatedAt: Date
}

export interface Analytics {
  id: string
  metric: AnalyticsMetric
  value: number
  platform?: SocialPlatform
  period: 'daily' | 'weekly' | 'monthly'
  date: Date
  businessId: string
  createdAt: Date
}

export interface Payment {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  method: 'sslcommerz' | 'bkash' | 'stripe'
  transactionId?: string
  businessId: string
  createdAt: Date
  updatedAt: Date
}

export interface AIModel {
  id: string
  name: string
  type: 'gpt-4' | 'gpt-3.5-turbo' | 'dall-e-3' | 'custom'
  description: string
  pricing: {
    input: number
    output: number
    image?: number
  }
  isActive: boolean
  createdAt: Date
}

export interface AIUsage {
  id: string
  modelId: string
  businessId: string
  userId: string
  type: 'text' | 'image' | 'embedding'
  inputTokens: number
  outputTokens?: number
  cost: number
  createdAt: Date
}

export type UserRole = 'super_admin' | 'business_admin' | 'moderator' | 'content_creator' | 'analyst' | 'viewer'
export type BusinessSize = 'small' | 'medium' | 'large' | 'enterprise'
export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube' | 'pinterest' | 'whatsapp'
export type AnalyticsMetric = 'followers' | 'engagement' | 'reach' | 'impressions' | 'clicks' | 'conversions' | 'sentiment'
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type PaymentMethod = 'sslcommerz' | 'bkash' | 'stripe'
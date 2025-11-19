import { prisma } from '@/lib/prisma'
import { TokenEncryptionService } from './token-encryption-service'
import crypto from 'crypto'
import { logger } from '@/lib/logging/logger-service'

export interface FacebookOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface OAuthState {
  userId: string
  nonce: string
  timestamp: number
  scopes: string[]
}

export interface FacebookTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

export interface FacebookUserProfile {
  id: string
  name: string
  email?: string
  picture?: {
    data: {
      url: string
    }
  }
}

export class FacebookOAuthService {
  private readonly encryptionService: TokenEncryptionService
  private readonly config: FacebookOAuthConfig

  constructor(config: FacebookOAuthConfig) {
    this.config = config
    this.encryptionService = new TokenEncryptionService()
  }

  /**
   * Generate secure OAuth authorization URL with state parameter
   */
  generateAuthUrl(userId: string, additionalScopes: string[] = []): { url: string; state: string } {
    const nonce = crypto.randomBytes(16).toString('hex')
    const timestamp = Date.now()
    
    const stateData: OAuthState = {
      userId,
      nonce,
      timestamp,
      scopes: [...this.config.scopes, ...additionalScopes]
    }

    const state = Buffer.from(JSON.stringify(stateData)).toString('base64')
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: stateData.scopes.join(','),
      response_type: 'code',
      state,
      auth_type: 'rerequest' // Allow re-requesting declined permissions
    })

    return {
      url: `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`,
      state
    }
  }

  /**
   * Validate and parse OAuth state parameter
   */
  validateState(state: string): OAuthState | null {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString()) as OAuthState
      
      // Validate timestamp (5 minute expiry)
      if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
        logger.warn('OAuth state expired', { userId: stateData.userId })
        return null
      }

      return stateData
    } catch (error) {
      logger.error('Invalid OAuth state', { error, state })
      return null
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<FacebookTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code
    })

    const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`)
    
    if (!response.ok) {
      const error = await response.json()
      logger.error('Failed to exchange code for token', { error, code: code.substring(0, 10) + '...' })
      throw new Error(`Token exchange failed: ${error.error?.message || 'Unknown error'}`)
    }

    return await response.json()
  }

  /**
   * Get user profile using access token
   */
  async getUserProfile(accessToken: string): Promise<FacebookUserProfile> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}&fields=id,name,email,picture`)
    
    if (!response.ok) {
      const error = await response.json()
      logger.error('Failed to get user profile', { error })
      throw new Error(`Profile fetch failed: ${error.error?.message || 'Unknown error'}`)
    }

    return await response.json()
  }

  /**
   * Get user's Facebook pages using access token
   */
  async getUserPages(accessToken: string): Promise<Array<{
    id: string
    name: string
    access_token: string
    category: string
    category_list: Array<{ id: string; name: string }>
    tasks: string[]
    instagram_business_account?: { id: string }
  }>> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token,category,category_list,tasks,instagram_business_account`)
    
    if (!response.ok) {
      const error = await response.json()
      logger.error('Failed to get user pages', { error })
      throw new Error(`Pages fetch failed: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    return data.data || []
  }

  /**
   * Store Facebook account in database with encrypted tokens
   */
  async storeFacebookAccount(userId: string, profile: FacebookUserProfile, accessToken: string, refreshToken?: string): Promise<void> {
    const encryptedAccessToken = this.encryptionService.encrypt(accessToken)
    const encryptedRefreshToken = refreshToken ? this.encryptionService.encrypt(refreshToken) : null

    await prisma.facebookAccount.upsert({
      where: { facebookUserId: profile.id },
      update: {
        userId,
        name: profile.name,
        email: profile.email,
        profilePicture: profile.picture?.data?.url,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        lastTokenRefresh: new Date(),
        connectionStatus: 'CONNECTED',
        lastConnectedAt: new Date()
      },
      create: {
        userId,
        facebookUserId: profile.id,
        name: profile.name,
        email: profile.email,
        profilePicture: profile.picture?.data?.url,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        lastTokenRefresh: new Date(),
        connectionStatus: 'CONNECTED',
        lastConnectedAt: new Date()
      }
    })

    logger.info('Facebook account stored successfully', { userId, facebookUserId: profile.id })
  }

  /**
   * Store Facebook pages in database with encrypted tokens
   */
  async storeFacebookPages(accountId: string, pages: Array<{
    id: string
    name: string
    access_token: string
    category: string
    category_list: Array<{ id: string; name: string }>
    tasks: string[]
    instagram_business_account?: { id: string }
  }>): Promise<void> {
    for (const page of pages) {
      const encryptedPageToken = this.encryptionService.encrypt(page.access_token)
      
      await prisma.facebookPage.upsert({
        where: { facebookPageId: page.id },
        update: {
          facebookAccountId: accountId,
          name: page.name,
          category: page.category,
          categoryList: page.category_list.map(cat => cat.name),
          pageAccessTokenEncrypted: encryptedPageToken,
          tasks: page.tasks,
          instagramBusinessAccountId: page.instagram_business_account?.id,
          tokenScopes: this.config.scopes,
          connectionStatus: 'CONNECTED',
          lastConnectedAt: new Date()
        },
        create: {
          facebookPageId: page.id,
          facebookAccountId: accountId,
          name: page.name,
          category: page.category,
          categoryList: page.category_list.map(cat => cat.name),
          pageAccessTokenEncrypted: encryptedPageToken,
          tasks: page.tasks,
          instagramBusinessAccountId: page.instagram_business_account?.id,
          tokenScopes: this.config.scopes,
          connectionStatus: 'CONNECTED',
          lastConnectedAt: new Date()
        }
      })
    }

    logger.info('Facebook pages stored successfully', { accountId, pageCount: pages.length })
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<FacebookTokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      fb_exchange_token: refreshToken
    })

    const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`)
    
    if (!response.ok) {
      const error = await response.json()
      logger.error('Failed to refresh access token', { error })
      throw new Error(`Token refresh failed: ${error.error?.message || 'Unknown error'}`)
    }

    return await response.json()
  }

  /**
   * Revoke access token
   */
  async revokeAccessToken(accessToken: string): Promise<void> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${accessToken}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      logger.error('Failed to revoke access token', { error })
      throw new Error(`Token revocation failed: ${error.error?.message || 'Unknown error'}`)
    }

    logger.info('Access token revoked successfully')
  }

  /**
   * Validate access token and get token info
   */
  async validateToken(accessToken: string): Promise<{
    data: {
      app_id: string
      type: string
      application: string
      data_access_expires_at: number
      expires_at: number
      is_valid: boolean
      scopes: string[]
      user_id: string
    }
  }> {
    const response = await fetch(`https://graph.facebook.com/v18.0/debug_token?input_token=${accessToken}&access_token=${this.config.clientId}|${this.config.clientSecret}`)
    
    if (!response.ok) {
      const error = await response.json()
      logger.error('Failed to validate token', { error })
      throw new Error(`Token validation failed: ${error.error?.message || 'Unknown error'}`)
    }

    return await response.json()
  }
}
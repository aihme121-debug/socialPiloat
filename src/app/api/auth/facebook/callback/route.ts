import { NextRequest, NextResponse } from 'next/server'
import { FacebookOAuthService } from '@/lib/services/facebook-oauth-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

// Facebook OAuth configuration from environment variables
const facebookConfig = {
  clientId: process.env.FACEBOOK_APP_ID || '',
  clientSecret: process.env.FACEBOOK_APP_SECRET || '',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070'}/api/auth/facebook/callback`,
  scopes: [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_metadata',
    'pages_messaging',
    'pages_manage_posts',
    'pages_read_user_content',
    'public_profile',
    'email'
  ]
}

const oauthService = new FacebookOAuthService(facebookConfig)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      logger.error('Facebook OAuth error', { error, errorDescription, state })
      systemMonitor.log('facebook-oauth', 'OAuth error', 'error', { error, errorDescription })
      
      return NextResponse.redirect(
        new URL(`/admin/facebook-integration?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`, request.url)
      )
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('Missing OAuth parameters', { code: !!code, state: !!state })
      systemMonitor.log('facebook-oauth', 'Missing parameters', 'error', { code: !!code, state: !!state })
      
      return NextResponse.redirect(
        new URL('/admin/facebook-integration?error=invalid_request', request.url)
      )
    }

    // Validate state parameter
    const stateData = oauthService.validateState(state)
    if (!stateData) {
      logger.error('Invalid or expired OAuth state', { state })
      systemMonitor.log('facebook-oauth', 'Invalid state', 'error', { state })
      
      return NextResponse.redirect(
        new URL('/admin/facebook-integration?error=invalid_state', request.url)
      )
    }

    logger.info('Processing Facebook OAuth callback', { userId: stateData.userId })

    try {
      // Exchange code for access token
      const tokenResponse = await oauthService.exchangeCodeForToken(code)
      logger.info('Successfully exchanged code for token', { userId: stateData.userId })

      // Get user profile
      const profile = await oauthService.getUserProfile(tokenResponse.access_token)
      logger.info('Successfully fetched user profile', { userId: stateData.userId, facebookUserId: profile.id })

      // Store Facebook account with encrypted tokens
      await oauthService.storeFacebookAccount(
        stateData.userId,
        profile,
        tokenResponse.access_token,
        tokenResponse.refresh_token
      )

      // Get and store user's Facebook pages
      const pages = await oauthService.getUserPages(tokenResponse.access_token)
      logger.info('Successfully fetched user pages', { userId: stateData.userId, pageCount: pages.length })

      if (pages.length > 0) {
        // Get the stored account to get its ID
        const account = await prisma.facebookAccount.findUnique({
          where: { facebookUserId: profile.id }
        })

        if (account) {
          await oauthService.storeFacebookPages(account.id, pages)
          systemMonitor.log('facebook-oauth', 'Pages stored', 'info', { userId: stateData.userId, pageCount: pages.length })
        }
      }

      // Log successful connection
      systemMonitor.log('facebook-oauth', 'OAuth completed successfully', 'info', { 
        userId: stateData.userId, 
        facebookUserId: profile.id,
        pageCount: pages.length 
      })

      // Redirect to success page
      return NextResponse.redirect(
        new URL(`/admin/facebook-integration?success=true&pages=${pages.length}`, request.url)
      )

    } catch (error) {
      logger.error('OAuth processing failed', { error, userId: stateData.userId })
      systemMonitor.log('facebook-oauth', 'Processing failed', 'error', { error: error.message, userId: stateData.userId })
      
      return NextResponse.redirect(
        new URL(`/admin/facebook-integration?error=processing_failed&details=${encodeURIComponent(error.message)}`, request.url)
      )
    }

  } catch (error) {
    logger.error('Unexpected error in OAuth callback', { error })
    systemMonitor.log('facebook-oauth', 'Unexpected error', 'error', { error: error.message })
    
    return NextResponse.redirect(
      new URL('/admin/facebook-integration?error=internal_error', request.url)
    )
  }
}
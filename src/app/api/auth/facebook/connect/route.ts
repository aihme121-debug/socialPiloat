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

export async function POST(request: NextRequest) {
  try {
    const { userId, additionalScopes = [] } = await request.json()

    // Validate required parameters
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if Facebook app credentials are configured
    if (!facebookConfig.clientId || !facebookConfig.clientSecret) {
      logger.error('Facebook app credentials not configured')
      systemMonitor.log('facebook-oauth', 'Credentials not configured', 'error')
      
      return NextResponse.json(
        { success: false, error: 'Facebook app credentials not configured' },
        { status: 500 }
      )
    }

    // Generate OAuth authorization URL
    const { url, state } = oauthService.generateAuthUrl(userId, additionalScopes)
    
    logger.info('Generated Facebook OAuth URL', { userId, state: state.substring(0, 20) + '...' })
    systemMonitor.log('facebook-oauth', 'OAuth URL generated', 'info', { userId })

    return NextResponse.json({
      success: true,
      authUrl: url,
      state
    })

  } catch (error) {
    logger.error('Failed to generate Facebook OAuth URL', { error })
    systemMonitor.log('facebook-oauth', 'Failed to generate URL', 'error', { error: error.message })
    
    return NextResponse.json(
      { success: false, error: 'Failed to generate OAuth URL' },
      { status: 500 }
    )
  }
}
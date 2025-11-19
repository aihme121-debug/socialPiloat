import { NextRequest, NextResponse } from 'next/server'
import { logger, LogLevel } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'
import { FacebookConfigService } from '@/lib/services/facebook-config-service'
import { facebookConnectionManager } from '@/lib/services/facebook-connection-manager'
import { FacebookWebhookManager } from '@/lib/services/facebook-webhook-manager'

export async function POST(request: NextRequest) {
  try {
    const { pageId, token } = await request.json()
    
    if (!pageId || !token) {
      return NextResponse.json({ 
        success: false, 
        error: 'pageId and token are required' 
      }, { status: 400 })
    }

    logger.info('Attempting to subscribe app to Facebook page', { pageId })

    // Validate token first
    const configService = FacebookConfigService.getInstance()
    const appId = configService.getAppId()
    const appSecret = configService.getAppSecret()
    
    if (!appId || !appSecret) {
      return NextResponse.json({ 
        success: false, 
        error: 'Facebook app credentials not configured' 
      }, { status: 400 })
    }

    // First, verify the page token is valid
    const tokenValidationUrl = `https://graph.facebook.com/v18.0/me?access_token=${token}&fields=id,name`
    const tokenValidationResponse = await fetch(tokenValidationUrl)
    
    if (!tokenValidationResponse.ok) {
      const tokenError = await tokenValidationResponse.json()
      logger.warn('Invalid page access token', { 
        pageId, 
        error: tokenError.error?.message 
      })
      
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid page access token',
        details: tokenError.error?.message || 'Token validation failed'
      }, { status: 400 })
    }

    const tokenData = await tokenValidationResponse.json()
    logger.info('Page token validated successfully', { 
      pageId: tokenData.id, 
      pageName: tokenData.name 
    })

    // First, check if the app is already subscribed to the page
    const checkSubscriptionUrl = `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${token}`
    let isAlreadySubscribed = false
    
    try {
      const checkResponse = await fetch(checkSubscriptionUrl)
      if (checkResponse.ok) {
        const subscribedApps = await checkResponse.json()
        const appId = configService.getAppId()
        isAlreadySubscribed = subscribedApps.data?.some((app: any) => app.id === appId)
        
        if (isAlreadySubscribed) {
          logger.info('App is already subscribed to page', { pageId, appId })
          return NextResponse.json({ 
            success: true, 
            message: 'App is already subscribed to this page',
            alreadySubscribed: true,
            pageId
          })
        }
      }
    } catch (checkError) {
      logger.warn('Failed to check existing subscriptions', { pageId, error: checkError })
    }

    // Check page permissions and roles
    const pageRolesUrl = `https://graph.facebook.com/v18.0/${pageId}?access_token=${token}&fields=roles,perms`
    try {
      const rolesResponse = await fetch(pageRolesUrl)
      if (rolesResponse.ok) {
        const pageData = await rolesResponse.json()
        logger.info('Page roles and permissions checked', { 
          pageId, 
          hasRoles: !!pageData.roles,
          hasPerms: !!pageData.perms 
        })
      }
    } catch (rolesError) {
      logger.warn('Failed to check page roles', { pageId, error: rolesError })
    }

    // Subscribe the app to the page
    const subscribeUrl = new URL(`https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`)
    subscribeUrl.searchParams.set('access_token', token)
    subscribeUrl.searchParams.set('subscribed_fields', 'messages,messaging_postbacks,messaging_deliveries,messaging_reads')

    const subscribeResponse = await fetch(subscribeUrl.toString(), { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    let responseData: any
    try {
      responseData = await subscribeResponse.json()
    } catch {
      responseData = { raw: await subscribeResponse.text() }
    }

    if (!subscribeResponse.ok) {
      const errorMessage = responseData.error?.message || 'Failed to subscribe app to page'
      const errorCode = responseData.error?.code
      const errorType = responseData.error?.type
      
      logger.error('Failed to subscribe app to page', new Error(errorMessage), { 
        pageId, 
        status: subscribeResponse.status, 
        errorCode,
        errorType,
        responseData
      })
      
      systemMonitor.log('facebook', 'Page subscription failed', LogLevel.ERROR, {
        pageId,
        status: subscribeResponse.status,
        error: errorMessage,
        errorCode,
        errorType
      })
      
      // Provide detailed error guidance
      let userErrorMessage = errorMessage
      let errorDetails = {}
      
      if (errorCode === 100 && errorMessage.includes('does not exist')) {
        userErrorMessage = 'Page ID not found or invalid. Please verify the Page ID is correct.'
        errorDetails = { 
          suggestion: 'Check that the page ID is correct and the page exists',
          pageId: pageId
        }
      } else if (errorCode === 200 && errorMessage.includes('permissions')) {
        userErrorMessage = 'Insufficient permissions. Your access token needs pages_manage_metadata permission.'
        errorDetails = { 
          suggestion: 'Generate a new access token with pages_manage_metadata permission',
          requiredPermissions: ['pages_manage_metadata', 'pages_messaging', 'pages_show_list'],
          currentToken: token.substring(0, 10) + '...'
        }
      } else if (subscribeResponse.status === 400 && errorMessage.includes('Unsupported post request')) {
        userErrorMessage = 'Cannot subscribe app to page. This usually means insufficient permissions or the app is not authorized for this page.'
        errorDetails = { 
          suggestion: 'Ensure your Facebook app has the required permissions and is authorized for this page',
          requiredPermissions: ['pages_manage_metadata', 'pages_messaging', 'pages_show_list'],
          troubleshooting: [
            '1. Go to your Facebook App Dashboard',
            '2. Navigate to Messenger > Settings',
            '3. Add your page to the connected pages',
            '4. Generate a new page access token with all required permissions'
          ]
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        error: userErrorMessage,
        details: errorDetails,
        status: subscribeResponse.status,
        facebookError: {
          message: errorMessage,
          code: errorCode,
          type: errorType
        },
        data: responseData 
      }, { status: subscribeResponse.status })
    }

    logger.info('Successfully subscribed app to page webhook events', { pageId })
    
    // Use the new webhook manager for subscription
    const webhookManager = new FacebookWebhookManager()
    const subscriptionResult = await webhookManager.subscribePage({
      pageId,
      pageAccessToken: token,
      subscribedFields: ['messages', 'messaging_postbacks', 'messaging_deliveries', 'messaging_reads'],
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070'}/api/webhooks/facebook`,
      verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || 'default_verify_token'
    })

    if (subscriptionResult.success) {
      // Store the page access token for future use
      configService.addPageAccessToken(pageId, token)
      
      // Update system monitor
      systemMonitor.log('facebook', `Subscribed to page ${pageId} webhook events`, LogLevel.INFO, {
        pageId,
        response: responseData
      })
      
      // Update connection manager to reflect successful subscription
      await facebookConnectionManager.connectWebhook()

      return NextResponse.json({ 
        success: true, 
        message: 'Successfully subscribed to page webhook events',
        data: responseData,
        pageId,
        subscriptionId: subscriptionResult.subscriptionId
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: subscriptionResult.error,
        details: subscriptionResult.details
      }, { status: 400 })
    }
    
  } catch (error) {
    logger.error('Page subscription failed with unexpected error', error as Error)
    
    systemMonitor.log('facebook', 'Page subscription failed with unexpected error', LogLevel.ERROR, {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({ 
      success: false, 
      error: 'Page subscription failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}
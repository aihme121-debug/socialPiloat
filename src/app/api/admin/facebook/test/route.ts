import { NextRequest, NextResponse } from 'next/server'
import { FacebookConfigService } from '@/lib/services/facebook-config-service'
import { systemMonitor } from '@/lib/system/system-monitor'
import { logger } from '@/lib/logging/logger-service'

export async function POST(request: NextRequest) {
  try {
    logger.info('Testing Facebook integration...')
    
    const configService = FacebookConfigService.getInstance()
    
    // Test 1: Validate configuration
    const configValid = configService.isFullyConfigured()
    if (!configValid) {
      const configStatus = configService.getConfigurationStatus()
      logger.error('Facebook configuration invalid', undefined, { configStatus })
      return NextResponse.json({
        success: false,
        error: 'Configuration invalid',
        configStatus
      }, { status: 400 })
    }
    
    // Test 2: Test Graph API connection
    const appId = configService.getAppId()
    const appSecret = configService.getAppSecret()
    const appAccessToken = `${appId}|${appSecret}`
    
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/app?access_token=${appAccessToken}`
      )
      
      if (response.ok) {
        const data = await response.json()
        logger.info('Facebook Graph API test successful', { appId: data.id, name: data.name })
        systemMonitor.updateFacebookApiStatus('connected', 200)
      } else {
        const error = await response.json()
        logger.error('Facebook Graph API test failed', undefined, { error: error.error?.message })
        systemMonitor.updateFacebookApiStatus('error', 0, error.error?.message || 'API test failed')
        return NextResponse.json({
          success: false,
          error: 'Graph API test failed',
          apiError: error.error?.message
        }, { status: 500 })
      }
    } catch (error) {
      logger.error('Facebook Graph API connection error', error instanceof Error ? error : undefined)
      systemMonitor.updateFacebookApiStatus('error', 0, error instanceof Error ? error.message : 'Connection error')
      return NextResponse.json({
        success: false,
        error: 'Graph API connection error',
        connectionError: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
    
    // Test 3: Test webhook configuration
    const webhookValid = await configService.validateWebhookConfiguration()
    
    const result = {
      success: true,
      configuration: configValid,
      graphApi: true,
      webhook: webhookValid,
      timestamp: new Date().toISOString()
    }
    
    logger.info('Facebook integration test completed successfully', result)
    return NextResponse.json(result)
    
  } catch (error) {
    logger.error('Facebook integration test failed', error instanceof Error ? error : undefined)
    return NextResponse.json({
      success: false,
      message: 'Error testing Facebook integration',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const configService = FacebookConfigService.getInstance()
    const configStatus = configService.getConfigurationStatus()
    
    return NextResponse.json({
      success: true,
      configStatus
    })
  } catch (error) {
    logger.error('Error getting Facebook configuration status', error instanceof Error ? error : undefined)
    return NextResponse.json({
      success: false,
      message: 'Error getting Facebook configuration status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
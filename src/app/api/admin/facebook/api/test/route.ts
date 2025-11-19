import { NextRequest, NextResponse } from 'next/server'
import { FacebookConfigService } from '@/lib/services/facebook-config-service'
import { systemMonitor } from '@/lib/system/system-monitor'
import { logger, LogLevel } from '@/lib/logging/logger-service'

export async function POST(request: NextRequest) {
  try {
    const { endpoint, method = 'GET', params = {} } = await request.json()

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Graph API endpoint is required' },
        { status: 400 }
      )
    }

    const configService = FacebookConfigService.getInstance()
    const config = configService.getConfig()

    if (!config.appId || !config.appSecret) {
      return NextResponse.json(
        { error: 'Facebook app credentials not configured' },
        { status: 400 }
      )
    }

    // Build the Graph API URL
    const baseUrl = `${config.baseURL}/${config.apiVersion}`
    const url = new URL(`${baseUrl}/${endpoint}`)
    
    // Add access token
    url.searchParams.set('access_token', `${config.appId}|${config.appSecret}`)
    
    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    })

    logger.info('Testing Facebook Graph API', { 
      endpoint, 
      method,
      url: url.toString()
    })

    // Make the API request
    const response = await fetch(url.toString(), {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    let data: any
    try {
      data = await response.json()
    } catch {
      data = { raw: await response.text() }
    }

    if (!response.ok) {
      const errorMessage = `Facebook Graph API test failed with status ${response.status}`;
      logger.error(errorMessage, new Error(JSON.stringify(data)), { 
        endpoint,
        method,
        status: response.status
      })

      systemMonitor.log('facebook', 'Facebook Graph API test failed', LogLevel.ERROR, {
        endpoint,
        method,
        status: response.status,
        error: data
      })

      return NextResponse.json({
        success: false,
        error: 'Graph API test failed',
        status: response.status,
        data
      }, { status: response.status })
    }

    logger.info('Facebook Graph API test successful', { 
      endpoint, 
      method,
      status: response.status
    })

    // Log the successful test
    systemMonitor.log('facebook', 'Facebook Graph API test successful', LogLevel.INFO, {
      endpoint,
      method,
      status: response.status
    })

    return NextResponse.json({
      success: true,
      message: 'Graph API test completed successfully',
      data,
      endpoint,
      method,
      timestamp: new Date()
    })
  } catch (error) {
    logger.error('Failed to test Facebook Graph API', error as Error)
    systemMonitor.updateFacebookApiStatus('error', 0, error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to test Facebook Graph API' },
      { status: 502 }
    )
  }
}
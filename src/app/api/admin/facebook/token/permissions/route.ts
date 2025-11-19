import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'
import { FacebookConfigService } from '@/lib/services/facebook-config-service'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 })
    }

    const configService = FacebookConfigService.getInstance()
    const appId = configService.getAppId()
    const appSecret = configService.getAppSecret()
    if (!appId || !appSecret) {
      return NextResponse.json({ success: false, error: 'Facebook app credentials missing' }, { status: 400 })
    }

    const appAccessToken = `${appId}|${appSecret}`

    // Debug token via App Token
    const debugUrl = new URL('https://graph.facebook.com/v18.0/debug_token')
    debugUrl.searchParams.set('input_token', token)
    debugUrl.searchParams.set('access_token', appAccessToken)

    const debugResp = await fetch(debugUrl.toString())
    const debugData = await debugResp.json()

    // Permissions via Page/User token
    const permsUrl = new URL('https://graph.facebook.com/v18.0/me/permissions')
    permsUrl.searchParams.set('access_token', token)
    const permsResp = await fetch(permsUrl.toString())
    const permsData = await permsResp.json()

    // Log and update monitor
    systemMonitor.log('facebook', 'Checked token permissions', undefined as any, {
      debug_ok: debugResp.ok,
      perms_ok: permsResp.ok,
    })

    return NextResponse.json({
      success: true,
      debug: debugData,
      permissions: permsData,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Failed to check token permissions', error as Error)
    systemMonitor.updateFacebookApiStatus('error', 0, error instanceof Error ? error.message : 'Token permissions error')
    return NextResponse.json({ success: false, error: 'Failed to check token permissions' }, { status: 502 })
  }
}
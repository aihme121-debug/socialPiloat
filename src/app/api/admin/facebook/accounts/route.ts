import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TokenEncryptionService } from '@/lib/services/token-encryption-service'
import { logger } from '@/lib/logging/logger-service'
import { systemMonitor } from '@/lib/system/system-monitor'

const encryptionService = new TokenEncryptionService()

export async function GET(request: NextRequest) {
  try {
    // For now, get all Facebook accounts (in production, this should be filtered by user)
    const accounts = await prisma.facebookAccount.findMany({
      include: {
        pages: {
          select: {
            id: true,
            facebookPageId: true,
            name: true,
            category: true,
            connectionStatus: true,
            webhookSubscribed: true,
            lastConnectedAt: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            pages: true,
            webhookEvents: true,
            actionsLog: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Decrypt and sanitize data for response
    const sanitizedAccounts = accounts.map(account => ({
      id: account.id,
      facebookUserId: account.facebookUserId,
      name: account.name,
      email: account.email,
      profilePicture: account.profilePicture,
      connectionStatus: account.connectionStatus,
      tokenExpiresAt: account.tokenExpiresAt,
      lastConnectedAt: account.lastConnectedAt,
      lastTokenRefresh: account.lastTokenRefresh,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      pages: account.pages,
      stats: {
        totalPages: account._count.pages,
        totalWebhookEvents: account._count.webhookEvents,
        totalActions: account._count.actionsLog
      }
    }))

    logger.info('Fetched Facebook accounts', { count: sanitizedAccounts.length })
    systemMonitor.log('facebook-admin', 'Accounts fetched', 'info', { count: sanitizedAccounts.length })

    return NextResponse.json({
      success: true,
      accounts: sanitizedAccounts,
      total: sanitizedAccounts.length
    })

  } catch (error) {
    logger.error('Failed to fetch Facebook accounts', { error })
    systemMonitor.log('facebook-admin', 'Failed to fetch accounts', 'error', { error: error.message })
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Facebook accounts' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Get account details before deletion
    const account = await prisma.facebookAccount.findUnique({
      where: { id: accountId }
    })

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      )
    }

    try {
      // Decrypt access token for revocation
      const accessToken = encryptionService.decrypt(account.accessTokenEncrypted)
      
      // Revoke Facebook access token
      const oauthService = new (await import('@/lib/services/facebook-oauth-service')).FacebookOAuthService({
        clientId: process.env.FACEBOOK_APP_ID || '',
        clientSecret: process.env.FACEBOOK_APP_SECRET || '',
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:7070'}/api/auth/facebook/callback`,
        scopes: []
      })

      await oauthService.revokeAccessToken(accessToken)
      logger.info('Facebook access token revoked', { accountId })
    } catch (revokeError) {
      logger.warn('Failed to revoke Facebook access token', { accountId, error: revokeError })
      // Continue with deletion even if revocation fails
    }

    // Delete account and related data (cascade will handle related records)
    await prisma.facebookAccount.delete({
      where: { id: accountId }
    })

    logger.info('Facebook account deleted', { accountId })
    systemMonitor.log('facebook-admin', 'Account deleted', 'info', { accountId })

    return NextResponse.json({
      success: true,
      message: 'Facebook account disconnected successfully'
    })

  } catch (error) {
    logger.error('Failed to delete Facebook account', { error })
    systemMonitor.log('facebook-admin', 'Failed to delete account', 'error', { error: error.message })
    
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Facebook account' },
      { status: 500 }
    )
  }
}
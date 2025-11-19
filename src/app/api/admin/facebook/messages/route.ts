import { NextRequest, NextResponse } from 'next/server'
import { systemMonitor } from '@/lib/system/system-monitor'
import { logger } from '@/lib/logging/logger-service'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pageIdParam = searchParams.get('pageId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const tokenOverride = searchParams.get('token') || undefined
    
    logger.info('Fetching real Facebook messages...', { pageId: pageIdParam, limit })

    // Resolve access token: override from query or from database
    let accessToken: string | undefined = tokenOverride
    let targetPageId: string | undefined = pageIdParam || undefined

    if (!accessToken) {
      const account = await prisma.socialAccount.findFirst({
        where: { platform: 'FACEBOOK', isActive: true },
      })
      if (!account) {
        return NextResponse.json({ success: false, error: 'No active Facebook account found' }, { status: 404 })
      }
      try {
        const settings: any = account.settings || {}
        const pages: any[] = Array.isArray(settings.pages) ? settings.pages : []
        if (pages.length > 0) {
          accessToken = pages[0].access_token || account.accessToken || undefined
          targetPageId = targetPageId || pages[0].id
        } else {
          accessToken = account.accessToken || undefined
          targetPageId = targetPageId || account.accountId
        }
      } catch {}
    }

    if (!accessToken) {
      return NextResponse.json({ success: false, error: 'No page access token available' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    // If pageId still unknown, resolve using /me with the page token
    if (!targetPageId) {
      const meUrl = `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
      const meResp = await fetch(meUrl)
      const meData = await meResp.json()
      if (!meResp.ok || meData.error) {
        return NextResponse.json({ success: false, error: meData?.error?.message || 'Failed to resolve page id' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
      }
      targetPageId = String(meData.id)
    }
    
    try {
      // Fetch conversations for the page using the page access token
      const conversationsUrl = `https://graph.facebook.com/v18.0/${targetPageId}/conversations?fields=id,updated_time,message_count,unread_count,participants&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`
      const conversationsResponse = await fetch(conversationsUrl)
      
      if (!conversationsResponse.ok) {
        const error = await conversationsResponse.json()
        logger.warn('Could not fetch conversations', { error: error.error?.message })
        
        // Try to fetch page information as fallback
        const pageInfoUrl = `https://graph.facebook.com/v18.0/${targetPageId}?fields=id,name,fan_count&access_token=${encodeURIComponent(accessToken)}`
        const pageInfoResponse = await fetch(pageInfoUrl)
        
        if (pageInfoResponse.ok) {
          const pageData = await pageInfoResponse.json()
          logger.info('Page info retrieved', pageData)
          
          return NextResponse.json({
            success: true,
            pageInfo: pageData,
            messages: [],
            message: 'Page found but no conversations available. This is expected for app pages.'
          }, { headers: { 'Cache-Control': 'no-store' } })
        } else {
          const pageError = await pageInfoResponse.json()
          return NextResponse.json({
            success: false,
            error: 'Could not fetch page information',
            apiError: pageError.error?.message
          }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
        }
      }
      
      const conversationsData = await conversationsResponse.json()
      const conversations = conversationsData.data || []
      
      logger.info(`Found ${conversations.length} conversations`)
      
      // Fetch messages from each conversation
      const allMessages = []
      
      for (const conversation of conversations) {
        try {
          const messagesUrl = `https://graph.facebook.com/v18.0/${conversation.id}/messages?fields=id,message,created_time,from,to&limit=10&access_token=${encodeURIComponent(accessToken)}`
          const messagesResponse = await fetch(messagesUrl)
          
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            const messages = messagesData.data || []
            
            allMessages.push(...messages.map((msg: any) => ({
              ...msg,
              conversationId: conversation.id,
              conversationParticipants: conversation.participants
            })))
          }
        } catch (error) {
          logger.warn(`Error fetching messages for conversation ${conversation.id}`, error instanceof Error ? error : undefined)
        }
      }
      
      logger.info(`Fetched ${allMessages.length} real messages from Facebook`)
      systemMonitor.log('facebook', `Retrieved ${allMessages.length} real messages`)
      
      return NextResponse.json({
        success: true,
        messages: allMessages,
        conversationsCount: conversations.length,
        messagesCount: allMessages.length,
        pageId: targetPageId
      }, { headers: { 'Cache-Control': 'no-store' } })
      
    } catch (error) {
      logger.error('Error fetching Facebook messages', error instanceof Error ? error : undefined)
      return NextResponse.json({
        success: false,
        error: 'Error fetching Facebook messages',
        apiError: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
    
  } catch (error) {
    logger.error('Error in fetch real messages endpoint', error instanceof Error ? error : undefined)
    return NextResponse.json({
      success: false,
      message: 'Error fetching real Facebook messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { 
  MessageCircle, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Facebook,
  Filter,
  Eye,
  EyeOff,
  Shield,
  ShieldAlert
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

export interface FacebookMessageData {
  messageId: string
  senderId: string
  senderName: string
  recipientId: string
  recipientName: string
  content: string
  timestamp: string
  platform: 'FACEBOOK'
  conversationId: string
  isRead: boolean
  isReplied: boolean
  isAutomated: boolean
  authenticityScore: number
  messageType: 'message' | 'comment' | 'post'
  verificationStatus: 'verified' | 'unverified' | 'suspicious'
}

export interface MessageStats {
  totalMessages: number
  verifiedMessages: number
  suspiciousMessages: number
  automatedMessages: number
}

interface FacebookMessageDisplayProps {
  pageId: string
  businessId: string
  autoRefresh?: boolean
  refreshInterval?: number
  maxMessages?: number
  showFilters?: boolean
  onMessageSelect?: (message: FacebookMessageData) => void
  onReplyClick?: (message: FacebookMessageData) => void
}

export function FacebookMessageDisplay({
  pageId,
  businessId,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  maxMessages = 50,
  showFilters = true,
  onMessageSelect,
  onReplyClick
}: FacebookMessageDisplayProps) {
  const [messages, setMessages] = useState<FacebookMessageData[]>([])
  const [stats, setStats] = useState<MessageStats | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState({
    excludeAutomated: true,
    excludeSponsored: true,
    excludeSuspicious: false,
    minConfidenceScore: 0.5,
    showOnlyUnread: false
  })
  const [selectedMessage, setSelectedMessage] = useState<FacebookMessageData | null>(null)
  
  const { toast } = useToast()

  /**
   * Fetch messages from the API
   */
  const fetchMessages = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true)
      }
      
      const params = new URLSearchParams({
        pageId,
        businessId,
        limit: maxMessages.toString(),
        excludeAutomated: filter.excludeAutomated.toString(),
        excludeSponsored: filter.excludeSponsored.toString(),
        minConfidenceScore: filter.minConfidenceScore.toString()
      })

      const response = await fetch(`/api/facebook/messages/retrieve?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setMessages(data.data.messages)
        setStats(data.data.stats)
        setLastSyncTime(data.data.lastSyncTime ? new Date(data.data.lastSyncTime) : new Date())
        setError(null)
        
        if (forceRefresh) {
          toast({
            title: 'Messages refreshed',
            description: `Found ${data.data.messages.length} authentic messages`,
            duration: 3000
          })
        }
      } else {
        throw new Error(data.error || 'Failed to fetch messages')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch messages'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [pageId, businessId, maxMessages, filter, toast])

  /**
   * Refresh messages
   */
  const handleRefresh = useCallback(async () => {
    await fetchMessages(true)
  }, [fetchMessages])

  /**
   * Mark message as read
   */
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      const response = await fetch('/api/facebook/messages/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          businessId,
          action: 'mark_read',
          messageIds: [messageId]
        })
      })

      if (response.ok) {
        setMessages(prev => 
          prev.map(msg => 
            msg.messageId === messageId ? { ...msg, isRead: true } : msg
          )
        )
      }
    } catch (err) {
      console.error('Error marking message as read:', err)
    }
  }, [pageId, businessId])

  /**
   * Handle message selection
   */
  const handleMessageSelect = useCallback((message: FacebookMessageData) => {
    setSelectedMessage(message)
    if (!message.isRead) {
      markAsRead(message.messageId)
    }
    onMessageSelect?.(message)
  }, [markAsRead, onMessageSelect])

  /**
   * Handle reply click
   */
  const handleReplyClick = useCallback((message: FacebookMessageData) => {
    onReplyClick?.(message)
  }, [onReplyClick])

  /**
   * Filter messages based on current filter settings
   */
  const filteredMessages = messages.filter(message => {
    if (filter.excludeAutomated && message.isAutomated) return false
    if (filter.excludeSuspicious && message.verificationStatus === 'suspicious') return false
    if (filter.showOnlyUnread && message.isRead) return false
    if (message.authenticityScore < filter.minConfidenceScore) return false
    return true
  })

  /**
   * Auto-refresh effect
   */
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchMessages()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchMessages])

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  /**
   * Get verification status icon and color
   */
  const getVerificationIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <Shield className="h-4 w-4 text-green-500" />
      case 'suspicious':
        return <ShieldAlert className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  /**
   * Get authenticity score color
   */
  const getAuthenticityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading Facebook messages...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            <CardTitle>Facebook Messages</CardTitle>
            {stats && (
              <Badge variant="outline">
                {filteredMessages.length} messages
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {lastSyncTime && (
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                Last updated: {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        {stats && (
          <CardDescription>
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span className="text-xs">{stats.verifiedMessages} verified</span>
              </div>
              <div className="flex items-center space-x-1">
                <ShieldAlert className="h-3 w-3 text-red-600" />
                <span className="text-xs">{stats.suspiciousMessages} suspicious</span>
              </div>
              <div className="flex items-center space-x-1">
                <MessageCircle className="h-3 w-3 text-blue-600" />
                <span className="text-xs">{stats.automatedMessages} automated</span>
              </div>
            </div>
          </CardDescription>
        )}
      </CardHeader>

      {showFilters && (
        <CardContent>
          <div className="flex items-center space-x-4 mb-4 p-3 bg-muted rounded-lg">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filter.excludeAutomated}
                  onChange={(e) => setFilter(prev => ({ ...prev, excludeAutomated: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Hide automated</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filter.excludeSuspicious}
                  onChange={(e) => setFilter(prev => ({ ...prev, excludeSuspicious: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Hide suspicious</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filter.showOnlyUnread}
                  onChange={(e) => setFilter(prev => ({ ...prev, showOnlyUnread: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Unread only</span>
              </label>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent>
        <ScrollArea className="h-[500px] w-full">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mb-2" />
              <p>No authentic messages found</p>
              <p className="text-sm">Try adjusting your filters or refresh to check for new messages</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => (
                <div
                  key={message.messageId}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedMessage?.messageId === message.messageId
                      ? 'border-blue-500 bg-blue-50'
                      : message.isRead
                      ? 'border-gray-200 bg-white hover:bg-gray-50'
                      : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => handleMessageSelect(message)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900">
                              {message.senderName}
                            </h4>
                            <div className="flex items-center space-x-1">
                              {getVerificationIcon(message.verificationStatus)}
                              <Badge 
                                variant={message.verificationStatus === 'verified' ? 'outline' : 'secondary'}
                                className="text-xs"
                              >
                                {message.verificationStatus}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <span className={getAuthenticityColor(message.authenticityScore)}>
                              {Math.round(message.authenticityScore * 100)}% authentic
                            </span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{message.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {!message.isRead && (
                              <Badge variant="outline" className="text-xs">
                                <EyeOff className="h-3 w-3 mr-1" />
                                Unread
                              </Badge>
                            )}
                            {message.isReplied && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Replied
                              </Badge>
                            )}
                            {message.isAutomated && (
                              <Badge variant="outline" className="text-xs">
                                <MessageCircle className="h-3 w-3 mr-1" />
                                Automated
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReplyClick(message)
                            }}
                            className="text-xs"
                          >
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
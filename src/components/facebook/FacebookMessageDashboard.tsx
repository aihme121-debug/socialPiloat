'use client'

import React, { useState, useEffect } from 'react'
import { FacebookMessageDisplay, FacebookMessageData } from '@/components/facebook/FacebookMessageDisplay'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { 
  Facebook, 
  Settings, 
  MessageCircle, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Filter,
  Shield,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface FacebookMessageDashboardProps {
  pageId: string
  businessId: string
  pageName?: string
  pageAccessToken?: string
}

interface MessageStats {
  totalMessages: number
  verifiedMessages: number
  suspiciousMessages: number
  automatedMessages: number
  unreadMessages: number
  lastSyncTime?: Date
}

interface DashboardSettings {
  autoRefresh: boolean
  refreshInterval: number
  excludeAutomated: boolean
  excludeSuspicious: boolean
  showOnlyUnread: boolean
  minConfidenceScore: number
  enableRealTimeUpdates: boolean
  enableWebhook: boolean
}

export function FacebookMessageDashboard({
  pageId,
  businessId,
  pageName = 'Facebook Page',
  pageAccessToken
}: FacebookMessageDashboardProps) {
  const [messages, setMessages] = useState<FacebookMessageData[]>([])
  const [stats, setStats] = useState<MessageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected')
  const [selectedMessage, setSelectedMessage] = useState<FacebookMessageData | null>(null)
  const [replyDialogOpen, setReplyDialogOpen] = useState(false)
  const [replyMessage, setReplyMessage] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [settings, setSettings] = useState<DashboardSettings>({
    autoRefresh: true,
    refreshInterval: 30000,
    excludeAutomated: true,
    excludeSuspicious: false,
    showOnlyUnread: false,
    minConfidenceScore: 0.5,
    enableRealTimeUpdates: true,
    enableWebhook: true
  })
  const [showSettings, setShowSettings] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

  const { toast } = useToast()

  /**
   * Initialize Facebook messaging connection
   */
  const initializeConnection = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if we have the required credentials
      if (!pageId || !businessId) {
        throw new Error('Missing required parameters: pageId and businessId')
      }

      // Test connection to Facebook API
      const response = await fetch(`/api/facebook/messages/retrieve?pageId=${pageId}&businessId=${businessId}&limit=1`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to connect to Facebook API')
      }

      setConnectionStatus('connected')
      setLastRefreshTime(new Date())
      
      toast({
        title: 'Connected to Facebook',
        description: `Successfully connected to ${pageName}`,
        duration: 3000
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Facebook connection'
      setError(errorMessage)
      setConnectionStatus('error')
      
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Fetch messages and stats
   */
  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams({
        pageId,
        businessId,
        limit: '50',
        excludeAutomated: settings.excludeAutomated.toString(),
        excludeSponsored: 'true',
        excludeHidden: 'true',
        minConfidenceScore: settings.minConfidenceScore.toString()
      })

      const response = await fetch(`/api/facebook/messages/retrieve?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setMessages(data.data.messages)
        setStats(data.data.stats)
        setLastRefreshTime(new Date())
        setError(null)
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
      // Don't show toast for background refresh errors
    }
  }

  /**
   * Handle message selection
   */
  const handleMessageSelect = (message: FacebookMessageData) => {
    setSelectedMessage(message)
  }

  /**
   * Handle reply to message
   */
  const handleReply = async () => {
    if (!selectedMessage || !replyMessage.trim()) return

    try {
      setSendingReply(true)

      const response = await fetch('/api/facebook/messages/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          businessId,
          recipientId: selectedMessage.senderId,
          message: replyMessage.trim(),
          conversationId: selectedMessage.conversationId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send reply')
      }

      toast({
        title: 'Reply sent',
        description: 'Your message has been sent successfully',
        duration: 3000
      })

      // Close dialog and reset
      setReplyDialogOpen(false)
      setReplyMessage('')
      setSelectedMessage(null)

      // Refresh messages
      await fetchMessages()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reply'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      setSendingReply(false)
    }
  }

  /**
   * Handle settings update
   */
  const updateSettings = (newSettings: Partial<DashboardSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
    
    // If auto-refresh setting changed, restart the interval
    if ('autoRefresh' in newSettings || 'refreshInterval' in newSettings) {
      // The effect will handle the interval restart
    }
  }

  /**
   * Mark all messages as read
   */
  const markAllAsRead = async () => {
    try {
      const unreadMessageIds = messages
        .filter(msg => !msg.isRead)
        .map(msg => msg.messageId)

      if (unreadMessageIds.length === 0) return

      const response = await fetch('/api/facebook/messages/retrieve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId,
          businessId,
          action: 'mark_read',
          messageIds: unreadMessageIds
        })
      })

      if (response.ok) {
        setMessages(prev => 
          prev.map(msg => ({ ...msg, isRead: true }))
        )
        
        toast({
          title: 'Messages marked as read',
          description: `${unreadMessageIds.length} messages marked as read`,
          duration: 3000
        })
      }
    } catch (err) {
      console.error('Error marking messages as read:', err)
    }
  }

  /**
   * Auto-refresh effect
   */
  useEffect(() => {
    if (!settings.autoRefresh || connectionStatus !== 'connected') return

    const interval = setInterval(() => {
      fetchMessages()
    }, settings.refreshInterval)

    return () => clearInterval(interval)
  }, [settings.autoRefresh, settings.refreshInterval, connectionStatus])

  /**
   * Initial connection effect
   */
  useEffect(() => {
    initializeConnection()
  }, [pageId, businessId])

  /**
   * Get connection status color
   */
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  /**
   * Get connection status icon
   */
  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Connecting to Facebook...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (connectionStatus === 'error') {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex space-x-2">
            <Button onClick={initializeConnection}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
            <Button variant="outline" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Facebook className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>{pageName} - Message Dashboard</CardTitle>
                <CardDescription>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`flex items-center space-x-1 ${getConnectionStatusColor()}`}>
                      {getConnectionStatusIcon()}
                      <span className="text-sm capitalize">{connectionStatus}</span>
                    </div>
                    {lastRefreshTime && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <div className="flex items-center space-x-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">
                            Last updated: {formatDistanceToNow(lastRefreshTime, { addSuffix: true })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMessages}
                disabled={connectionStatus !== 'connected'}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {stats && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Messages</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.totalMessages}</p>
                  </div>
                  <MessageCircle className="h-8 w-8 text-blue-400" />
                </div>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Verified</p>
                    <p className="text-2xl font-bold text-green-900">{stats.verifiedMessages}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
              </div>
              
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 font-medium">Suspicious</p>
                    <p className="text-2xl font-bold text-red-900">{stats.suspiciousMessages}</p>
                  </div>
                  <Shield className="h-8 w-8 text-red-400" />
                </div>
              </div>
              
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Unread</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {messages.filter(m => !m.isRead).length}
                    </p>
                  </div>
                  <Eye className="h-8 w-8 text-purple-400" />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Message Display */}
      <FacebookMessageDisplay
        pageId={pageId}
        businessId={businessId}
        autoRefresh={settings.autoRefresh}
        refreshInterval={settings.refreshInterval}
        maxMessages={100}
        showFilters={true}
        onMessageSelect={handleMessageSelect}
        onReplyClick={(message) => {
          setSelectedMessage(message)
          setReplyDialogOpen(true)
        }}
      />

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMessage && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{selectedMessage.senderName}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(selectedMessage.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{selectedMessage.content}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Reply</label>
              <Textarea
                placeholder="Type your reply message..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReplyDialogOpen(false)
                  setReplyMessage('')
                  setSelectedMessage(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReply}
                disabled={!replyMessage.trim() || sendingReply}
              >
                {sendingReply ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dashboard Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Auto Refresh</h4>
              <div className="flex items-center justify-between">
                <label className="text-sm">Enable auto refresh</label>
                <button
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoRefresh ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  onClick={() => updateSettings({ autoRefresh: !settings.autoRefresh })}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Refresh interval (seconds)</label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={settings.refreshInterval / 1000}
                  onChange={(e) => updateSettings({ refreshInterval: parseInt(e.target.value) * 1000 })}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={!settings.autoRefresh}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Message Filtering</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm">Hide automated messages</label>
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.excludeAutomated ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    onClick={() => updateSettings({ excludeAutomated: !settings.excludeAutomated })}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.excludeAutomated ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm">Hide suspicious messages</label>
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.excludeSuspicious ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    onClick={() => updateSettings({ excludeSuspicious: !settings.excludeSuspicious })}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.excludeSuspicious ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Minimum confidence score</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.minConfidenceScore}
                    onChange={(e) => updateSettings({ minConfidenceScore: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="text-xs text-muted-foreground">
                    Current: {Math.round(settings.minConfidenceScore * 100)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
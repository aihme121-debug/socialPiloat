'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity, 
  Eye, 
  MessageSquare, 
  ThumbsUp, 
  Share,
  Clock,
  User,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WebhookEvent {
  id: string
  facebookPageId: string
  eventType: string
  eventData: any
  processed: boolean
  error?: string
  createdAt: string
  page?: {
    name: string
    category: string
  }
}

interface WebhookEventsPanelProps {
  accountId: string
  pages: Array<{
    id: string
    facebookPageId: string
    name: string
    category: string
  }>
}

export default function WebhookEventsPanel({ accountId, pages }: WebhookEventsPanelProps) {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'messages' | 'comments' | 'reactions' | 'posts'>('all')
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { toast } = useToast()

  const fetchEvents = async () => {
    try {
      const response = await fetch(`/api/admin/facebook/webhook-events?accountId=${accountId}`)
      const data = await response.json()

      if (data.success) {
        setEvents(data.events)
      } else {
        toast({
          title: 'Failed to fetch events',
          description: data.error || 'Unable to load webhook events',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Failed to fetch webhook events',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshEvents = async () => {
    setRefreshing(true)
    await fetchEvents()
  }

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType.toLowerCase()) {
      case 'message':
      case 'messages':
        return <MessageSquare className="h-4 w-4" />
      case 'reaction':
      case 'reactions':
        return <ThumbsUp className="h-4 w-4" />
      case 'share':
      case 'shares':
        return <Share className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getEventBadgeVariant = (eventType: string) => {
    switch (eventType.toLowerCase()) {
      case 'message':
      case 'messages':
        return 'default'
      case 'reaction':
      case 'reactions':
        return 'secondary'
      case 'share':
      case 'shares':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getPageInfo = (pageId: string) => {
    return pages.find(page => page.facebookPageId === pageId)
  }

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    return event.eventType.toLowerCase().includes(filter)
  })

  useEffect(() => {
    fetchEvents()
  }, [accountId])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchEvents, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, accountId])

  const formatEventData = (data: any) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook Events</CardTitle>
          <CardDescription>Real-time Facebook page activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Webhook Events</CardTitle>
            <CardDescription>Real-time Facebook page activity</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-green-50' : ''}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshEvents}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filter Controls */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex space-x-1">
              {(['all', 'messages', 'comments', 'reactions', 'posts'] as const).map((filterType) => (
                <Button
                  key={filterType}
                  variant={filter === filterType ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(filterType)}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Events List */}
          {filteredEvents.length === 0 ? (
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertDescription>
                No webhook events found. Events will appear here when Facebook sends notifications to your webhook endpoint.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <AnimatePresence>
                {filteredEvents.map((event) => {
                  const pageInfo = getPageInfo(event.facebookPageId)
                  const isExpanded = expandedEvents.has(event.id)

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="mt-1">
                            {getEventIcon(event.eventType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge variant={getEventBadgeVariant(event.eventType)} className="text-xs">
                                {event.eventType}
                              </Badge>
                              {pageInfo && (
                                <span className="text-sm text-muted-foreground truncate">
                                  {pageInfo.name}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-2 mb-2">
                              {event.processed ? (
                                <Badge variant="default" className="text-xs bg-green-500">Processed</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Pending</Badge>
                              )}
                              {event.error && (
                                <Badge variant="destructive" className="text-xs">Error</Badge>
                              )}
                            </div>

                            {event.error && (
                              <Alert variant="destructive" className="mb-2">
                                <AlertDescription className="text-xs">{event.error}</AlertDescription>
                              </Alert>
                            )}

                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleEventExpansion(event.id)}
                                className="h-6 px-2 text-xs"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-3 w-3 mr-1" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                    Show Details
                                  </>
                                )}
                              </Button>
                              
                              {event.eventData?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const url = `https://facebook.com/${event.eventData.id}`
                                    window.open(url, '_blank')
                                  }}
                                  className="h-6 px-2 text-xs"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                              )}
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-3"
                                >
                                  <div className="bg-gray-100 rounded p-2 text-xs font-mono overflow-x-auto">
                                    <pre className="whitespace-pre-wrap">
                                      {formatEventData(event.eventData)}
                                    </pre>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Stats Footer */}
          {events.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
              <div className="flex items-center space-x-4">
                <span>Total Events: {events.length}</span>
                <span>Processed: {events.filter(e => e.processed).length}</span>
                <span>Errors: {events.filter(e => e.error).length}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
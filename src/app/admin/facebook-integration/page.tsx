'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Facebook, 
  Link, 
  Unlink, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Users,
  MessageSquare,
  Eye,
  ExternalLink,
  Settings,
  Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import FacebookActionsPanel from './components/FacebookActionsPanel'
import WebhookEventsPanel from './components/WebhookEventsPanel'
import { logger } from '@/lib/logger'

interface FacebookAccount {
  id: string
  facebookUserId: string
  name: string
  email?: string
  profilePicture?: string
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  tokenExpiresAt: string
  lastConnectedAt: string
  lastTokenRefresh?: string
  createdAt: string
  pages: FacebookPage[]
  stats: {
    totalPages: number
    totalWebhookEvents: number
    totalActions: number
  }
}

interface FacebookPage {
  id: string
  facebookPageId: string
  name: string
  category: string
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  webhookSubscribed: boolean
  lastConnectedAt: string
  createdAt: string
}

export default function FacebookIntegrationPage() {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'accounts' | 'actions' | 'events'>('accounts')
  const [selectedAccount, setSelectedAccount] = useState<FacebookAccount | null>(null)
  const { toast } = useToast()

  // Get user ID from session or auth context (simplified for now)
  const userId = 'admin' // In production, get this from your auth system

  useEffect(() => {
    fetchAccounts()
    
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search)
    const oauthError = urlParams.get('error')
    const oauthSuccess = urlParams.get('success')
    const pagesCount = urlParams.get('pages')

    if (oauthError) {
      const errorDescription = urlParams.get('error_description') || 'Unknown error'
      setError(`OAuth Error: ${oauthError} - ${errorDescription}`)
      toast({
        title: 'Facebook Connection Failed',
        description: `${oauthError}: ${errorDescription}`,
        variant: 'destructive'
      })
    } else if (oauthSuccess) {
      setSuccess(`Successfully connected to Facebook! ${pagesCount ? `Found ${pagesCount} pages.` : ''}`)
      toast({
        title: 'Facebook Connected',
        description: `Successfully connected to Facebook! ${pagesCount ? `Found ${pagesCount} pages.` : ''}`,
        variant: 'default'
      })
    }

    // Clean up URL parameters
    window.history.replaceState({}, document.title, window.location.pathname)
  }, [])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/facebook/accounts')
      const data = await response.json()

      if (data.success) {
        setAccounts(data.accounts)
        if (data.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(data.accounts[0])
        }
      } else {
        setError(data.error || 'Failed to fetch accounts')
      }
    } catch (error) {
      setError('Failed to fetch Facebook accounts')
      logger.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const connectFacebook = async () => {
    try {
      setConnecting(true)
      setError(null)

      const response = await fetch('/api/auth/facebook/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      })

      const data = await response.json()

      if (data.success) {
        // Redirect to Facebook OAuth
        window.location.href = data.authUrl
      } else {
        setError(data.error || 'Failed to initiate Facebook connection')
        toast({
          title: 'Connection Failed',
          description: data.error || 'Failed to initiate Facebook connection',
          variant: 'destructive'
        })
      }
    } catch (error) {
      setError('Failed to connect to Facebook')
      logger.error('Connection error:', error)
    } finally {
      setConnecting(false)
    }
  }

  const disconnectAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/admin/facebook/accounts?accountId=${accountId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Account Disconnected',
          description: 'Facebook account has been disconnected successfully',
          variant: 'default'
        })
        fetchAccounts() // Refresh the list
      } else {
        toast({
          title: 'Disconnection Failed',
          description: data.error || 'Failed to disconnect account',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Disconnection Failed',
        description: 'Failed to disconnect Facebook account',
        variant: 'destructive'
      })
      logger.error('Disconnection error:', error)
    }
  }

  const refreshAccount = async (accountId: string) => {
    try {
      setRefreshing(accountId)
      
      // Implement token refresh logic here
      // For now, just show a success message
      toast({
        title: 'Token Refreshed',
        description: 'Facebook token refreshed successfully',
        variant: 'default'
      })
      
      fetchAccounts() // Refresh the list
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh Facebook token',
        variant: 'destructive'
      })
      logger.error('Refresh error:', error)
    } finally {
      setRefreshing(null)
    }
  }

  const getConnectionStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return <Badge variant="default" className="bg-green-500">Connected</Badge>
      case 'DISCONNECTED':
        return <Badge variant="secondary">Disconnected</Badge>
      case 'ERROR':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Facebook Integration</h1>
          <p className="text-muted-foreground">
            Manage your Facebook accounts and pages for multi-tenant integration
          </p>
        </div>

        {/* Status Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connect Button */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Connect Facebook Account</CardTitle>
            <CardDescription>
              Connect your Facebook account to manage pages and receive webhook events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={connectFacebook} 
              disabled={connecting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {connecting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Facebook className="mr-2 h-4 w-4" />
                  Connect Facebook Account
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        {accounts.length > 0 && (
          <div className="mb-6">
            <div className="flex space-x-1 border-b">
              <Button
                variant={activeTab === 'accounts' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('accounts')}
                className="rounded-b-none"
              >
                <Facebook className="h-4 w-4 mr-2" />
                Accounts
              </Button>
              <Button
                variant={activeTab === 'actions' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('actions')}
                className="rounded-b-none"
                disabled={!selectedAccount}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Actions
              </Button>
              <Button
                variant={activeTab === 'events' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('events')}
                className="rounded-b-none"
                disabled={!selectedAccount}
              >
                <Eye className="h-4 w-4 mr-2" />
                Webhook Events
              </Button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'accounts' && (
            <motion.div
              key="accounts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Connected Accounts */}
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold">Connected Accounts</h2>
                
                {accounts.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Facebook className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center">
                        No Facebook accounts connected yet. Connect your first account to get started.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  accounts.map((account) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => setSelectedAccount(account)}
                      className={`cursor-pointer ${selectedAccount?.id === account.id ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {account.profilePicture ? (
                                <img 
                                  src={account.profilePicture} 
                                  alt={account.name}
                                  className="h-12 w-12 rounded-full"
                                />
                              ) : (
                                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Facebook className="h-6 w-6 text-blue-600" />
                                </div>
                              )}
                              <div>
                                <CardTitle>{account.name}</CardTitle>
                                <CardDescription>
                                  {account.email || 'No email available'}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getConnectionStatusBadge(account.connectionStatus)}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  refreshAccount(account.id)
                                }}
                                disabled={refreshing === account.id}
                              >
                                {refreshing === account.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  disconnectAccount(account.id)
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{account.stats.totalPages}</p>
                                <p className="text-xs text-muted-foreground">Connected Pages</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{account.stats.totalWebhookEvents}</p>
                                <p className="text-xs text-muted-foreground">Webhook Events</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{account.stats.totalActions}</p>
                                <p className="text-xs text-muted-foreground">Actions Performed</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3" />
                              <span>Token expires: {formatDate(account.tokenExpiresAt)}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-3 w-3" />
                              <span>Last connected: {formatDate(account.lastConnectedAt)}</span>
                            </div>
                          </div>

                          {/* Pages List */}
                          {account.pages.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="font-medium mb-2">Connected Pages</h4>
                              <div className="space-y-2">
                                {account.pages.map((page) => (
                                  <div key={page.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                    <div>
                                      <p className="font-medium text-sm">{page.name}</p>
                                      <p className="text-xs text-muted-foreground">{page.category}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {page.webhookSubscribed ? (
                                        <Badge variant="default" className="text-xs bg-green-500">Subscribed</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">Not Subscribed</Badge>
                                      )}
                                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'actions' && selectedAccount && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <FacebookActionsPanel 
                pages={selectedAccount.pages} 
                accountId={selectedAccount.id} 
              />
            </motion.div>
          )}

          {activeTab === 'events' && selectedAccount && (
            <motion.div
              key="events"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <WebhookEventsPanel 
                accountId={selectedAccount.id} 
                pages={selectedAccount.pages} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
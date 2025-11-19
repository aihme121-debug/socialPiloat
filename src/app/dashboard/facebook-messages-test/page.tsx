'use client'

import React, { useState, useEffect } from 'react'
import { FacebookMessageDashboard } from '@/components/facebook/FacebookMessageDashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { Facebook, AlertCircle, Info } from 'lucide-react'

interface ConnectedPage {
  id: string
  name: string
  accessToken: string
  category: string
  connected: boolean
}

export default function FacebookMessagesTestPage() {
  const [connectedPages, setConnectedPages] = useState<ConnectedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<ConnectedPage | null>(null)
  const { toast } = useToast()

  /**
   * Fetch connected Facebook pages
   */
  const fetchConnectedPages = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch connected Facebook pages for the current user
      const response = await fetch('/api/social-accounts')
      
      if (!response.ok) {
        throw new Error('Failed to fetch connected pages')
      }
      
      const data = await response.json()
      
      // Filter for Facebook pages only
      const facebookPages = data.accounts
        ?.filter((account: any) => account.platform === 'FACEBOOK' && account.connected)
        .map((account: any) => ({
          id: account.accountId,
          name: account.name,
          accessToken: account.accessToken,
          category: account.category || 'Business Page',
          connected: account.connected
        })) || []

      setConnectedPages(facebookPages)
      
      // Auto-select first connected page
      if (facebookPages.length > 0) {
        setSelectedPage(facebookPages[0])
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch connected pages'
      setError(errorMessage)
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Connect a new Facebook page
   */
  const connectFacebookPage = () => {
    // Redirect to Facebook OAuth flow
    window.location.href = '/api/auth/social/facebook'
  }

  /**
   * Initialize connection on component mount
   */
  useEffect(() => {
    fetchConnectedPages()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <Facebook className="h-5 w-5 animate-pulse" />
              <span>Loading Facebook pages...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Facebook Message Retrieval</h1>
        <p className="text-gray-600">
          Retrieve and display authentic messages from your Facebook business page in real-time
        </p>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-blue-600" />
            <CardTitle>System Features</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
              <div>
                <h4 className="font-medium text-blue-900">Real-time Updates</h4>
                <p className="text-sm text-blue-700">Webhook integration with 30-second polling fallback</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
              <div>
                <h4 className="font-medium text-green-900">Message Authentication</h4>
                <p className="text-sm text-green-700">Multi-layer verification of message authenticity</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
              <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
              <div>
                <h4 className="font-medium text-purple-900">Smart Filtering</h4>
                <p className="text-sm text-purple-700">Excludes test messages, spam, and automated responses</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
              <div className="w-2 h-2 bg-orange-600 rounded-full mt-2"></div>
              <div>
                <h4 className="font-medium text-orange-900">Read/Unread Tracking</h4>
                <p className="text-sm text-orange-700">Visual distinction between read and unread messages</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
              <div className="w-2 h-2 bg-red-600 rounded-full mt-2"></div>
              <div>
                <h4 className="font-medium text-red-900">Error Handling</h4>
                <p className="text-sm text-red-700">Comprehensive error handling for API failures</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-indigo-50 rounded-lg">
              <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2"></div>
              <div>
                <h4 className="font-medium text-indigo-900">Platform Compliance</h4>
                <p className="text-sm text-indigo-700">Full compliance with Facebook Platform Policy</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Facebook Pages</CardTitle>
              <CardDescription>
                Select a Facebook page to view its messages
              </CardDescription>
            </div>
            <Button onClick={connectFacebookPage} variant="outline">
              <Facebook className="h-4 w-4 mr-2" />
              Connect New Page
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {connectedPages.length === 0 ? (
            <div className="text-center py-8">
              <Facebook className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Facebook Pages Connected</h3>
              <p className="text-gray-600 mb-4">
                Connect your Facebook business page to start retrieving messages
              </p>
              <Button onClick={connectFacebookPage}>
                <Facebook className="h-4 w-4 mr-2" />
                Connect Facebook Page
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {connectedPages.map((page) => (
                <div
                  key={page.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPage?.id === page.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                  onClick={() => setSelectedPage(page)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Facebook className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{page.name}</h4>
                        <p className="text-sm text-gray-600">{page.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={page.connected ? "outline" : "destructive"}>
                        {page.connected ? "Connected" : "Disconnected"}
                      </Badge>
                      {selectedPage?.id === page.id && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Dashboard */}
      {selectedPage && (
        <Card>
          <CardHeader>
            <CardTitle>Message Dashboard</CardTitle>
            <CardDescription>
              Real-time message retrieval for {selectedPage.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FacebookMessageDashboard
              pageId={selectedPage.id}
              businessId="demo_business" // You should replace this with actual business ID
              pageName={selectedPage.name}
              pageAccessToken={selectedPage.accessToken}
            />
          </CardContent>
        </Card>
      )}

      {/* Configuration Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Requirements</CardTitle>
          <CardDescription>
            Ensure these environment variables are configured for the system to work properly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="text-sm text-gray-700 overflow-x-auto">
{`# Facebook API Configuration
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
FACEBOOK_WEBHOOK_SECRET=your_facebook_webhook_secret_here
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_facebook_webhook_verify_token_here

# Required Facebook App Permissions:
# - pages_manage_posts
# - pages_read_engagement
# - pages_messaging
# - pages_show_list`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
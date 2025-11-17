'use client'

import { useAuth } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  Users, 
  Heart, 
  MessageCircle, 
  Share2, 
  TrendingUp,
  Calendar,
  Target,
  Zap,
  BarChart2,
  Eye,
  MousePointer
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

interface DashboardMetrics {
  totalPosts: number
  scheduledPosts: number
  publishedPosts: number
  socialAccounts: number
  engagementRate: number
  totalFollowers: number
  followerGrowth: string
  totalReach: number
  totalEngagement: number
}

interface RecentActivity {
  id: string
  type: string
  content: string
  platform: string
  status: string
  createdAt: string
  metrics: {
    likes?: number
    comments?: number
    shares?: number
    views?: number
  }
}

interface AnalyticsData {
  metrics: DashboardMetrics
  recentActivity: RecentActivity[]
  platformDistribution: Record<string, number>
  followerGrowth: Array<{ date: string; followers: number }>
  topPosts: Array<{
    id: string
    content: string
    engagement: number
    likes: number
    comments: number
    shares: number
    created_time: string
  }>
  timeRange: {
    start: string
    end: string
  }
}

function DashboardContent() {
  const { user } = useAuth()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/analytics/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await response.json()
      setAnalyticsData(data)
      setMetrics(data.metrics)
      setRecentActivity(data.recentActivity)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return <div className="w-4 h-4 bg-blue-600 rounded"></div>
      case 'instagram': return <div className="w-4 h-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded"></div>
      case 'twitter': return <div className="w-4 h-4 bg-sky-500 rounded"></div>
      case 'linkedin': return <div className="w-4 h-4 bg-blue-700 rounded"></div>
      default: return <div className="w-4 h-4 bg-gray-600 rounded"></div>
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook': return '#1877F2'
      case 'instagram': return '#E4405F'
      case 'twitter': return '#1DA1F2'
      case 'linkedin': return '#0A66C2'
      default: return '#6B7280'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
        </div>

        {/* Analytics Charts */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Follower Growth Chart */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Follower Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.followerGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [value.toLocaleString(), 'Followers']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="followers" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Platform Distribution */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Platform Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(analyticsData.platformDistribution).map(([platform, count]) => ({
                        name: platform.charAt(0).toUpperCase() + platform.slice(1),
                        value: count,
                        platform
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(analyticsData.platformDistribution).map(([platform], index) => (
                        <Cell key={`cell-${index}`} fill={getPlatformColor(platform)} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Performing Posts */}
        {analyticsData && analyticsData.topPosts.length > 0 && (
          <Card className="glass mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MousePointer className="w-5 h-5 mr-2" />
                Top Performing Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analyticsData.topPosts.map((post, index) => (
                  <div key={post.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(post.created_time).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                      {post.content}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center">
                        <Heart className="w-3 h-3 mr-1" />
                        {post.likes.toLocaleString()}
                      </span>
                      <span className="flex items-center">
                        <MessageCircle className="w-3 h-3 mr-1" />
                        {post.comments.toLocaleString()}
                      </span>
                      <span className="flex items-center">
                        <Share2 className="w-3 h-3 mr-1" />
                        {post.shares.toLocaleString()}
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {post.engagement.toLocaleString()} total
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-red-600 mb-4">{error}</div>
            <Button onClick={fetchDashboardData}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Welcome back, {user?.name || user?.email}! Here's your social media performance overview.
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass p-6 rounded-xl hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics?.totalPosts || 0}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {metrics?.publishedPosts || 0} published, {metrics?.scheduledPosts || 0} scheduled
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-xl hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Engagement Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics?.engagementRate || 0}%
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {metrics?.totalEngagement || 0} total interactions
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-xl hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Followers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics?.totalFollowers?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  +{metrics?.followerGrowth || 0}% growth
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-xl hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Reach</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {metrics?.totalReach?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Across all platforms
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h3>
              <Button variant="outline" size="sm" onClick={fetchDashboardData}>
                <BarChart2 className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                      {getPlatformIcon(activity.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {activity.content}
                        </p>
                        <Badge className={`text-xs ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {activity.platform}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {activity.metrics && (
                        <div className="flex items-center space-x-3 mt-2">
                          <span className="text-xs text-gray-500">
                            <Heart className="w-3 h-3 inline mr-1" />
                            {activity.metrics.likes || 0}
                          </span>
                          <span className="text-xs text-gray-500">
                            <MessageCircle className="w-3 h-3 inline mr-1" />
                            {activity.metrics.comments || 0}
                          </span>
                          <span className="text-xs text-gray-500">
                            <Share2 className="w-3 h-3 inline mr-1" />
                            {activity.metrics.shares || 0}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Calendar className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">No recent activity found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Create your first post to see activity here
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-2 group-hover:bg-blue-200 dark:group-hover:bg-blue-800">
                  <Zap className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Create Post</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">New content</p>
              </button>
              
              <button className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-2 group-hover:bg-green-200 dark:group-hover:bg-green-800">
                  <Calendar className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Schedule</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Plan content</p>
              </button>
              
              <button className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-2 group-hover:bg-purple-200 dark:group-hover:bg-purple-800">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Analytics</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">View reports</p>
              </button>
              
              <button className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-2 group-hover:bg-orange-200 dark:group-hover:bg-orange-800">
                  <Users className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Accounts</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Manage socials</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
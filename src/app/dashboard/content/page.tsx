'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Calendar, Clock, Send, Edit, Trash2, Eye, Filter, Facebook, Instagram, Twitter, Linkedin, Youtube, CheckCircle, XCircle, Clock3 } from 'lucide-react'

const platforms = [
  { id: 'FACEBOOK', name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
  { id: 'INSTAGRAM', name: 'Instagram', icon: Instagram, color: 'bg-gradient-to-r from-purple-600 to-pink-600' },
  { id: 'TWITTER', name: 'Twitter', icon: Twitter, color: 'bg-blue-400' },
  { id: 'LINKEDIN', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
  { id: 'YOUTUBE', name: 'YouTube', icon: Youtube, color: 'bg-red-600' },
]

const statusColors = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
}

function ContentManagementContent() {
  const { user } = useAuth()
  const [content, setContent] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchContent = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      params.append('page', currentPage.toString())
      params.append('limit', '10')

      const response = await fetch(`/api/content/create?${params}`)
      if (response.ok) {
        const data = await response.json()
        setContent(data.content)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error fetching content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchContent()
  }, [statusFilter, currentPage])

  const handleDelete = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return

    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchContent()
      }
    } catch (error) {
      console.error('Error deleting content:', error)
    }
  }

  const handlePublishNow = async (contentId: string) => {
    try {
      const response = await fetch(`/api/content/${contentId}/publish`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchContent()
      }
    } catch (error) {
      console.error('Error publishing content:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPlatformIcon = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId)
    if (!platform) return null
    const Icon = platform.icon
    return <Icon className="w-4 h-4 text-white" />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Content Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Manage your social media content and posts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="ALL">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {content.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Send className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No content yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Start creating your first social media post</p>
            <a
              href="/dashboard/content/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <Send className="w-4 h-4" />
              Create Content
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {content.map((item: any) => (
              <div key={item.id} className="glass p-6 rounded-xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {item.posts.map((post: any) => (
                      <div
                        key={post.id}
                        className={`w-6 h-6 rounded flex items-center justify-center ${
                          platforms.find(p => p.id === post.platforms[0])?.color || 'bg-gray-500'
                        }`}
                      >
                        {getPlatformIcon(post.platforms[0])}
                      </div>
                    ))}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[item.status as keyof typeof statusColors]}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-gray-800 dark:text-gray-200 line-clamp-3">
                    {item.contentText || 'No content text'}
                  </p>
                  {item.mediaUrls.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {item.mediaUrls.length} media file(s)
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>by {item.user.name || item.user.email}</span>
                  </div>
                </div>

                {item.status === 'SCHEDULED' && item.aiMetadata?.scheduledAt && (
                  <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                      <Clock3 className="w-4 h-4" />
                      <span>Scheduled for {formatDate(item.aiMetadata.scheduledAt)}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {item.status === 'DRAFT' && (
                    <button
                      onClick={() => handlePublishNow(item.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Publish
                    </button>
                  )}
                  
                  <a
                    href={`/dashboard/content/edit/${item.id}`}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </a>
                  
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            
            <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ContentManagementPage() {
  return (
    <ProtectedRoute>
      <ContentManagementContent />
    </ProtectedRoute>
  )
}
'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  MessageCircle, 
  Heart, 
  Share2, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  User,
  Eye,
  TrendingUp,
  Filter,
  Calendar,
  BarChart3
} from 'lucide-react';

interface FacebookComment {
  id: string;
  message: string;
  from: {
    id: string;
    name: string;
  };
  createdTime: string;
  likeCount: number;
  canReply: boolean;
}

interface FacebookPost {
  id: string;
  message: string;
  createdTime: string;
  likes: number;
  commentsCount: number;
  shares: number;
  attachments: any[];
  comments: FacebookComment[];
  engagementRate?: number;
  reach?: number;
}

interface FacebookAccount {
  id: string;
  name: string;
  platformId: string;
  profileImageUrl?: string;
}

export default function FacebookCommentsPage() {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [account, setAccount] = useState<FacebookAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'engagement' | 'comments'>('date');
  const [filterEngagement, setFilterEngagement] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/facebook/posts?limit=25');
      
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      
      // Calculate engagement rates
      const postsWithEngagement = data.posts?.map((post: FacebookPost) => ({
        ...post,
        engagementRate: post.reach && post.reach > 0 ? ((post.likes + post.commentsCount + post.shares) / post.reach * 100) : 0
      })) || [];
      
      setPosts(postsWithEngagement);
      setAccount(data.account);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (commentId: string, postId: string) => {
    if (!replyMessage.trim()) return;

    try {
      setSendingReply(true);
      const response = await fetch('/api/facebook/comments/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId,
          message: replyMessage,
          postId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send reply');
      }

      const data = await response.json();
      
      // Update local state with the new reply
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, {
              id: data.reply.id,
              message: replyMessage,
              from: { id: 'me', name: 'You' },
              createdTime: data.reply.createdTime,
              likeCount: 0,
              canReply: true
            }]
          };
        }
        return post;
      }));

      setReplyMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  };

  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedComments(newExpanded);
  };

  const selectPost = (postId: string) => {
    setSelectedPost(selectedPost === postId ? null : postId);
  };

  const getEngagementLevel = (rate: number) => {
    if (rate >= 5) return 'high';
    if (rate >= 2) return 'medium';
    return 'low';
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const filteredAndSortedPosts = posts
    .filter(post => {
      // Date range filter
      const postDate = new Date(post.createdTime);
      const now = new Date();
      let daysDiff = (now.getTime() - postDate.getTime()) / (1000 * 3600 * 24);
      
      if (dateRange === '7d' && daysDiff > 7) return false;
      if (dateRange === '30d' && daysDiff > 30) return false;
      if (dateRange === '90d' && daysDiff > 90) return false;
      
      // Engagement filter
      if (filterEngagement !== 'all') {
        const level = getEngagementLevel(post.engagementRate || 0);
        if (level !== filterEngagement) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'engagement':
          return (b.engagementRate || 0) - (a.engagementRate || 0);
        case 'comments':
          return b.commentsCount - a.commentsCount;
        case 'date':
        default:
          return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
      }
    });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatRelativeTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Facebook Posts Found</h3>
          <p className="text-gray-600 mb-4">
            {account ? `Connected to ${account.name}` : 'No Facebook account connected'}
          </p>
          <button
            onClick={fetchPosts}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Facebook Comments Manager</h1>
            <p className="text-gray-600 mt-1">
              {account && `Managing posts and comments for ${account.name}`}
            </p>
          </div>
          <button
            onClick={fetchPosts}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <select
                value={filterEngagement}
                onChange={(e) => setFilterEngagement(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Engagement</option>
                <option value="high">High (5%+)</option>
                <option value="medium">Medium (2-5%)</option>
                <option value="low">Low (&lt;2%)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Sort by Date</option>
                <option value="engagement">Sort by Engagement</option>
                <option value="comments">Sort by Comments</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MessageCircle className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Posts</p>
                <p className="text-2xl font-semibold text-gray-900">{filteredAndSortedPosts.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Heart className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Likes</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {filteredAndSortedPosts.reduce((sum, post) => sum + post.likes, 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MessageCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Comments</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {filteredAndSortedPosts.reduce((sum, post) => sum + post.commentsCount, 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Engagement</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {filteredAndSortedPosts.length > 0 
                    ? (filteredAndSortedPosts.reduce((sum, post) => sum + (post.engagementRate || 0), 0) / filteredAndSortedPosts.length).toFixed(1)
                    : '0.0'
                  }%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredAndSortedPosts.map((post) => (
          <div 
            key={post.id} 
            className={`bg-white rounded-lg shadow-sm border transition-all duration-200 ${
              selectedPost === post.id 
                ? 'border-blue-500 shadow-lg' 
                : 'border-gray-200 hover:shadow-md'
            }`}
          >
            {/* Post Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {account?.profileImageUrl ? (
                    <img
                      src={account.profileImageUrl}
                      alt={account.name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900">{account?.name}</p>
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(post.createdTime)}
                      </span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      getEngagementColor(getEngagementLevel(post.engagementRate || 0))
                    }`}>
                      {post.engagementRate?.toFixed(1) || '0.0'}% engagement
                    </span>
                  </div>
                  <p className="mt-2 text-gray-900 line-clamp-3">{post.message}</p>
                  
                  {/* Quick Stats */}
                  <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Heart className="h-4 w-4 mr-1" />
                      {post.likes}
                    </span>
                    <span className="flex items-center">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {post.commentsCount}
                    </span>
                    <span className="flex items-center">
                      <Share2 className="h-4 w-4 mr-1" />
                      {post.shares}
                    </span>
                    {post.reach && (
                      <span className="flex items-center">
                        <Eye className="h-4 w-4 mr-1" />
                        {post.reach.toLocaleString()} reach
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            {post.commentsCount > 0 && (
              <div className="p-6">
                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center justify-between w-full text-left mb-4 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {post.commentsCount} Comments
                  </span>
                  {expandedComments.has(post.id) ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>

                {expandedComments.has(post.id) && (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {comment.from.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatRelativeTime(comment.createdTime)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 mb-2">{comment.message}</p>
                            <div className="flex items-center space-x-4">
                              <span className="text-xs text-gray-500">
                                {comment.likeCount} likes
                              </span>
                              <button
                                onClick={() => setReplyingTo(comment.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Reply
                              </button>
                            </div>
                          </div>

                          {/* Reply Form */}
                          {replyingTo === comment.id && (
                            <div className="mt-3 flex space-x-2">
                              <input
                                type="text"
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                placeholder="Write a reply..."
                                className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleReply(comment.id, post.id);
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleReply(comment.id, post.id)}
                                disabled={sendingReply || !replyMessage.trim()}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {sendingReply ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyMessage('');
                                }}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Post Actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => selectPost(post.id)}
                  className={`text-sm font-medium ${
                    selectedPost === post.id 
                      ? 'text-blue-600 hover:text-blue-800' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {selectedPost === post.id ? 'Selected' : 'Select Post'}
                </button>
                <div className="text-xs text-gray-500">
                  Posted {formatDate(post.createdTime)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
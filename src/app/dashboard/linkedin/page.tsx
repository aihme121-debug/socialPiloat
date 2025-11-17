'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Linkedin, 
  ThumbsUp, 
  MessageCircle, 
  Share2, 
  BarChart3, 
  Send, 
  RefreshCw, 
  Users,
  Eye,
  AlertCircle,
  Building
} from 'lucide-react';

interface LinkedInPost {
  id: string;
  createdAt: string;
  content: string;
  visibility: string;
  media: any[];
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
  };
  engagementRate: string;
}

interface LinkedInAccount {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  platformId: string;
  followers: number;
  connections: number;
}

export default function LinkedInDashboard() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'CONNECTIONS'>('PUBLIC');
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalEngagement: 0,
    averageEngagement: 0,
    networkSize: 0
  });

  const fetchLinkedInData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/linkedin/posts');
      
      if (!response.ok) {
        throw new Error('Failed to fetch LinkedIn data');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
      
      if (data.accounts.length > 0) {
        const firstAccount = data.accounts[0];
        setSelectedAccount(firstAccount.account.id);
        setPosts(firstAccount.posts || []);
        
        // Calculate stats
        const totalEngagement = firstAccount.posts?.reduce((sum: number, post: LinkedInPost) => 
          sum + post.engagement.likes + post.engagement.comments + post.engagement.shares, 0) || 0;
        
        setStats({
          totalPosts: firstAccount.summary?.totalPosts || 0,
          totalEngagement: totalEngagement,
          averageEngagement: firstAccount.summary?.averageEngagement || 0,
          networkSize: firstAccount.account.connections || 0
        });
      }
    } catch (error) {
      console.error('Error fetching LinkedIn data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostUpdate = async () => {
    if (!newPost.trim() || !selectedAccount) return;

    try {
      setPosting(true);
      const response = await fetch('/api/linkedin/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newPost,
          accountId: selectedAccount,
          visibility: visibility
        })
      });

      if (!response.ok) {
        throw new Error('Failed to post update');
      }

      const result = await response.json();
      
      // Refresh data
      await fetchLinkedInData();
      setNewPost('');
      
    } catch (error) {
      console.error('Error posting update:', error);
      alert('Failed to post update. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getEngagementColor = (rate: string) => {
    const rateNum = parseFloat(rate);
    if (rateNum >= 3) return 'text-green-600';
    if (rateNum >= 1) return 'text-yellow-600';
    return 'text-red-600';
  };

  useEffect(() => {
    fetchLinkedInData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <Linkedin className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No LinkedIn Accounts Connected</h3>
          <p className="text-gray-600 mb-4">
            Connect your LinkedIn account to start sharing professional updates and building your network
          </p>
          <button
            onClick={() => window.location.href = '/dashboard/social-accounts'}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Linkedin className="h-4 w-4 mr-2" />
            Connect LinkedIn Account
          </button>
        </div>
      </div>
    );
  }

  const currentAccount = accounts.find(acc => acc.account.id === selectedAccount)?.account;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Linkedin className="h-8 w-8 text-blue-700" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">LinkedIn Management</h1>
              <p className="text-gray-600">Share professional updates and engage with your network</p>
            </div>
          </div>
          <button
            onClick={fetchLinkedInData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Account Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select LinkedIn Profile
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {accounts.map((acc) => (
              <option key={acc.account.id} value={acc.account.id}>
                {acc.account.firstName} {acc.account.lastName} ({formatNumber(acc.account.connections)} connections)
              </option>
            ))}
          </select>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Linkedin className="h-8 w-8 text-blue-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Posts</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalPosts}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ThumbsUp className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Engagement</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.totalEngagement)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Engagement</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.averageEngagement}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Network Size</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(currentAccount?.connections || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* New Post Composer */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Share an Update</h3>
          <div className="space-y-4">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What would you like to share with your network?"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              maxLength={3000}
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Visibility:</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="CONNECTIONS">Connections Only</option>
                  </select>
                </div>
                <div className="text-sm text-gray-500">
                  {newPost.length}/3000 characters
                </div>
              </div>
              
              <button
                onClick={handlePostUpdate}
                disabled={posting || !newPost.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {posting ? (
                  <>
                    <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="-ml-1 mr-2 h-4 w-4" />
                    Share Update
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
          <p className="text-sm text-gray-600 mt-1">Your latest LinkedIn activity</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {posts.map((post) => (
            <div key={post.id} className="p-6">
              <div className="flex space-x-3">
                <div className="flex-shrink-0">
                  {currentAccount?.profileImageUrl ? (
                    <img
                      src={currentAccount.profileImageUrl}
                      alt={`${currentAccount.firstName} ${currentAccount.lastName}`}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Building className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <p className="text-sm font-medium text-gray-900">
                      {currentAccount?.firstName} {currentAccount?.lastName}
                    </p>
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {post.visibility}
                    </span>
                  </div>
                  
                  <p className="text-gray-900 mb-4">{post.content}</p>
                  
                  {/* Post Metrics */}
                  <div className="flex items-center space-x-6 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Eye className="h-4 w-4 mr-1" />
                      {post.engagement.impressions.toLocaleString()} impressions
                    </span>
                    <span className="flex items-center">
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      {post.engagement.likes.toLocaleString()}
                    </span>
                    <span className="flex items-center">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {post.engagement.comments.toLocaleString()}
                    </span>
                    <span className="flex items-center">
                      <Share2 className="h-4 w-4 mr-1" />
                      {post.engagement.shares.toLocaleString()}
                    </span>
                    <span className={`flex items-center font-medium ${getEngagementColor(post.engagementRate)}`}>
                      <BarChart3 className="h-4 w-4 mr-1" />
                      {post.engagementRate}% engagement
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {posts.length === 0 && (
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
            <p className="text-gray-600">Start sharing updates to build your professional presence</p>
          </div>
        )}
      </div>
    </div>
  );
}
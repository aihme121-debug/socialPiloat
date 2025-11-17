'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  Twitter, 
  Heart, 
  MessageCircle, 
  Repeat2, 
  BarChart3, 
  Send, 
  RefreshCw, 
  TrendingUp,
  Users,
  Eye,
  AlertCircle
} from 'lucide-react';

interface TwitterMetrics {
  retweets: number;
  likes: number;
  replies: number;
  quotes: number;
  impressions: number;
}

interface TwitterTweet {
  id: string;
  text: string;
  createdAt: string;
  metrics: TwitterMetrics;
  engagementRate: string;
  media: any[];
  language: string;
}

interface TwitterAccount {
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  platformId: string;
  followers: number;
  following: number;
  tweetCount: number;
  verified: boolean;
}

export default function TwitterDashboard() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [tweets, setTweets] = useState<TwitterTweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTweet, setNewTweet] = useState('');
  const [posting, setPosting] = useState(false);
  const [stats, setStats] = useState({
    totalTweets: 0,
    totalEngagement: 0,
    averageEngagement: 0,
    followerGrowth: 0
  });

  const fetchTwitterData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/twitter/tweets');
      
      if (!response.ok) {
        throw new Error('Failed to fetch Twitter data');
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
      
      if (data.accounts.length > 0) {
        const firstAccount = data.accounts[0];
        setSelectedAccount(firstAccount.account.id);
        setTweets(firstAccount.tweets || []);
        
        // Calculate stats
        const totalEngagement = firstAccount.tweets?.reduce((sum: number, tweet: TwitterTweet) => 
          sum + tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies, 0) || 0;
        
        setStats({
          totalTweets: firstAccount.summary?.totalTweets || 0,
          totalEngagement: totalEngagement,
          averageEngagement: firstAccount.summary?.averageEngagement || 0,
          followerGrowth: 0 // Will implement later
        });
      }
    } catch (error) {
      console.error('Error fetching Twitter data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostTweet = async () => {
    if (!newTweet.trim() || !selectedAccount) return;

    try {
      setPosting(true);
      const response = await fetch('/api/twitter/tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newTweet,
          accountId: selectedAccount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to post tweet');
      }

      const result = await response.json();
      
      // Refresh data
      await fetchTwitterData();
      setNewTweet('');
      
    } catch (error) {
      console.error('Error posting tweet:', error);
      alert('Failed to post tweet. Please try again.');
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
    if (rateNum >= 5) return 'text-green-600';
    if (rateNum >= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  useEffect(() => {
    fetchTwitterData();
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
          <Twitter className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Twitter Accounts Connected</h3>
          <p className="text-gray-600 mb-4">
            Connect your Twitter account to start managing tweets and analyzing performance
          </p>
          <button
            onClick={() => window.location.href = '/dashboard/social-accounts'}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Twitter className="h-4 w-4 mr-2" />
            Connect Twitter Account
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
            <Twitter className="h-8 w-8 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Twitter Management</h1>
              <p className="text-gray-600">Manage tweets, monitor engagement, and analyze performance</p>
            </div>
          </div>
          <button
            onClick={fetchTwitterData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Account Selector */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Twitter Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {accounts.map((acc) => (
              <option key={acc.account.id} value={acc.account.id}>
                @{acc.account.username} ({formatNumber(acc.account.followers)} followers)
              </option>
            ))}
          </select>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Twitter className="h-8 w-8 text-blue-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Tweets</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalTweets}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Heart className="h-8 w-8 text-red-500" />
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
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Engagement</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.averageEngagement}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-purple-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Followers</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatNumber(currentAccount?.followers || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* New Tweet Composer */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Compose New Tweet</h3>
          <div className="space-y-4">
            <textarea
              value={newTweet}
              onChange={(e) => setNewTweet(e.target.value)}
              placeholder="What's happening?"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              maxLength={280}
            />
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {newTweet.length}/280 characters
              </div>
              <button
                onClick={handlePostTweet}
                disabled={posting || !newTweet.trim()}
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
                    Tweet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tweets */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Tweets</h3>
          <p className="text-sm text-gray-600 mt-1">Your latest tweet activity</p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {tweets.map((tweet) => (
            <div key={tweet.id} className="p-6">
              <div className="flex space-x-3">
                <div className="flex-shrink-0">
                  {currentAccount?.profileImageUrl ? (
                    <img
                      src={currentAccount.profileImageUrl}
                      alt={currentAccount.name}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Twitter className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900">{currentAccount?.name}</p>
                    <span className="text-sm text-gray-500">@{currentAccount?.username}</span>
                    <span className="text-sm text-gray-500">•</span>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(tweet.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  
                  <p className="mt-2 text-gray-900">{tweet.text}</p>
                  
                  {/* Tweet Metrics */}
                  <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Eye className="h-4 w-4 mr-1" />
                      {tweet.metrics.impressions.toLocaleString()} impressions
                    </span>
                    <span className="flex items-center">
                      <Heart className="h-4 w-4 mr-1" />
                      {tweet.metrics.likes.toLocaleString()}
                    </span>
                    <span className="flex items-center">
                      <Repeat2 className="h-4 w-4 mr-1" />
                      {tweet.metrics.retweets.toLocaleString()}
                    </span>
                    <span className="flex items-center">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {tweet.metrics.replies.toLocaleString()}
                    </span>
                    <span className={`flex items-center font-medium ${getEngagementColor(tweet.engagementRate)}`}>
                      <BarChart3 className="h-4 w-4 mr-1" />
                      {tweet.engagementRate}% engagement
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {tweets.length === 0 && (
          <div className="p-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tweets found</h3>
            <p className="text-gray-600">Start tweeting to see your content here</p>
          </div>
        )}
      </div>
    </div>
  );
}
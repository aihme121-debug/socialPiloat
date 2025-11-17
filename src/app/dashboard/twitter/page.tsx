'use client';

import TwitterDashboard from '@/components/social/TwitterDashboard';
import TwitterConnect from '@/components/social/TwitterConnect';
import { useState, useEffect } from 'react';
import { Twitter, AlertCircle, BarChart3, Users } from 'lucide-react';

export default function TwitterPage() {
  const [hasTwitterAccount, setHasTwitterAccount] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkTwitterConnection = async () => {
    try {
      const response = await fetch('/api/twitter/tweets');
      if (response.ok) {
        const data = await response.json();
        setHasTwitterAccount(data.accounts && data.accounts.length > 0);
      }
    } catch (error) {
      console.error('Error checking Twitter connection:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkTwitterConnection();
  }, []);

  const handleConnectSuccess = () => {
    checkTwitterConnection();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-6">
          <Twitter className="h-8 w-8 text-blue-500" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Twitter Management</h1>
            <p className="text-gray-600">Manage your Twitter presence with AI-powered tools and analytics</p>
          </div>
        </div>

        {!hasTwitterAccount ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-lg font-medium text-blue-900 mb-2">Connect Your Twitter Account</h3>
                <p className="text-blue-800 mb-4">
                  To start managing your Twitter presence, you'll need to connect your Twitter account. 
                  This will allow you to post tweets, monitor engagement, and access analytics.
                </p>
                <div className="bg-white rounded-lg p-4">
                  <TwitterConnect onSuccess={handleConnectSuccess} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <TwitterDashboard />
        )}
      </div>

      {/* Features Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Twitter Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Twitter className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Tweet Management</h4>
              <p className="text-sm text-gray-600 mt-1">Post tweets, threads, and schedule content</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Analytics</h4>
              <p className="text-sm text-gray-600 mt-1">Track engagement, reach, and performance metrics</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Audience Insights</h4>
              <p className="text-sm text-gray-600 mt-1">Understand your followers and their behavior</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Twitter, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface TwitterConnectProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function TwitterConnect({ onSuccess, onError }: TwitterConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTwitterConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Initiate Twitter OAuth flow
      const result = await signIn('twitter', {
        callbackUrl: '/dashboard/social-accounts',
        redirect: false
      });

      if (result?.error) {
        setError(result.error);
        onError?.(result.error);
      } else if (result?.ok) {
        onSuccess?.();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect Twitter account';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <Twitter className="h-6 w-6 text-white" />
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Twitter</h3>
          <p className="text-sm text-gray-600 mt-1">
            Connect your Twitter account to manage tweets, monitor engagement, and analyze performance
          </p>
          
          {error && (
            <div className="mt-3 flex items-center space-x-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={handleTwitterConnect}
            disabled={isConnecting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Connecting...
              </>
            ) : (
              <>
                <Twitter className="-ml-1 mr-2 h-4 w-4" />
                Connect Twitter
              </>
            )}
          </button>
        </div>
      </div>

      {/* Features Preview */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">What you can do:</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Post tweets and threads</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Monitor tweet performance</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Track follower growth</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Analyze engagement metrics</span>
          </div>
        </div>
      </div>
    </div>
  );
}
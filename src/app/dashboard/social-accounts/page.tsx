'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Youtube, 
  MessageCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  LucideIcon
} from 'lucide-react';

interface SocialAccount {
  id: string
  platform: string
  accountId?: string
  accountName?: string
  username?: string
  profileData?: any
  isActive: boolean
  connectedAt: string
  expiresAt?: string
}

interface PlatformConfig {
  name: string;
  icon: LucideIcon;
  color: string;
  authUrl: string;
  description: string;
  disabled?: boolean;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  FACEBOOK: {
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600 hover:bg-blue-700',
    authUrl: '/api/oauth/social/facebook',
    description: 'Connect your Facebook pages and Instagram accounts',
  },
  INSTAGRAM: {
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
    authUrl: '/api/oauth/social/instagram',
    description: 'Connect your Instagram business account',
  },
  TWITTER: {
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-sky-500 hover:bg-sky-600',
    authUrl: '/api/auth/signin/twitter',
    description: 'Connect your Twitter account to post tweets and monitor engagement',
    disabled: true,
  },
  LINKEDIN: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700 hover:bg-blue-800',
    authUrl: '/api/auth/signin/linkedin',
    description: 'Connect your LinkedIn account to share professional updates',
    disabled: true,
  },
  YOUTUBE: {
    name: 'YouTube',
    icon: Youtube,
    color: 'bg-red-600 hover:bg-red-700',
    authUrl: '#',
    description: 'Connect your YouTube channel (Coming Soon)',
    disabled: true,
  },
};

export default function SocialAccountsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getPrimaryPage = (acc: SocialAccount) => {
    const pages = acc?.profileData?.pages
    return Array.isArray(pages) && pages.length > 0 ? pages[0] : null
  }

  const getDisplayName = (acc: SocialAccount) => {
    const primary = getPrimaryPage(acc)
    return (
      acc.accountName ||
      acc.username ||
      primary?.name ||
      acc?.profileData?.profile?.name ||
      'Connected Account'
    )
  }

  const getFollowers = (acc: SocialAccount) => {
    const primary = getPrimaryPage(acc) as any
    const num = primary?.followers_count ?? primary?.fan_count
    return typeof num === 'number' ? num : null
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    const successParam = urlParams.get('success');

    if (errorParam) {
      setError(`Connection failed: ${errorParam}`);
    }
    if (successParam) {
      setSuccess('Account connected successfully!');
    }

    // Only fetch accounts if we have a session
    if (session?.user?.id) {
      fetchAccounts();
    }
  }, [session]);

  const fetchAccounts = async () => {
    try {
      console.log('Fetching social accounts...');
      console.log('Session user ID:', session?.user?.id);
      console.log('Session email:', session?.user?.email);
      
      const response = await fetch('/api/social-accounts');
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Unknown error' };
        }
        console.error('Failed to fetch accounts:', errorData);
        throw new Error(errorData.error || 'Failed to fetch accounts');
      }
      
      const data = await response.json();
      console.log('Social accounts data:', data);
      setAccounts(data.accounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError(`Failed to load social accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const connectAccount = (platform: string) => {
    const config = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS];
    if (config?.disabled) {
      setError(`${config.name} integration is coming soon!`);
      return;
    }
    
    if (config?.authUrl) {
      window.location.href = config.authUrl;
    }
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/social-accounts/${accountId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to disconnect account');
      
      setAccounts(accounts.filter(account => account.id !== accountId));
      setSuccess('Account disconnected successfully');
    } catch (error) {
      setError('Failed to disconnect account');
      console.error('Error disconnecting account:', error);
    }
  };

  const refreshAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/social-accounts/${accountId}/refresh`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to refresh account');
      
      await fetchAccounts();
      setSuccess('Account refreshed successfully');
    } catch (error) {
      setError('Failed to refresh account');
      console.error('Error refreshing account:', error);
    }
  };

  const getAccountStatus = (account: SocialAccount) => {
    if (!account.isActive) return 'Disconnected';
    if (account.expiresAt && new Date(account.expiresAt) < new Date()) return 'Expired';
    return 'Connected';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Connected': return 'bg-green-100 text-green-800';
      case 'Expired': return 'bg-yellow-100 text-yellow-800';
      case 'Disconnected': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Loading...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we load your session.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Social Media Accounts</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your social media accounts to start posting content across multiple platforms.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(PLATFORM_CONFIGS).map(([platform, config]) => {
          const account = accounts.find(acc => acc.platform === platform);
          const Icon = config.icon;
          
          return (
            <Card key={platform} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${config.color} text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {config.description}
                      </CardDescription>
                    </div>
                  </div>
                  {account && (
                    <Badge className={getStatusColor(getAccountStatus(account))}>
                      {getAccountStatus(account)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                {account ? (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">
                        {getDisplayName(account)}
                      </p>
                      <p>Platform: {platform}</p>
                      {account.accountId && <p>Page ID: {account.accountId}</p>}
                      {getFollowers(account) !== null && (
                        <p>Followers: {getFollowers(account)}</p>
                      )}
                      {getPrimaryPage(account)?.category && (
                        <p>Category: {getPrimaryPage(account)?.category}</p>
                      )}
                      {Array.isArray(getPrimaryPage(account)?.category_list) && getPrimaryPage(account)?.category_list.length > 0 && (
                        <p>
                          Categories: {getPrimaryPage(account)?.category_list.map((c: any) => c.name).join(', ')}
                        </p>
                      )}
                      <p>Connected: {new Date(account.connectedAt).toLocaleDateString()}</p>
                      {account.expiresAt && (
                        <p>Expires: {new Date(account.expiresAt).toLocaleDateString()}</p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}
                        className="flex-1"
                      >
                        Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refreshAccount(account.id)}
                        className="flex-1"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnectAccount(account.id)}
                        className="flex-1 text-red-600 hover:text-red-700"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Disconnect
                      </Button>
                    </div>
                    {expandedId === account.id && (
                      <div className="mt-4 space-y-2">
                        {account.platform === 'FACEBOOK' && account.profileData ? (
                          <div className="text-xs space-y-2">
                            {account.profileData?.profile?.name && (
                              <div className="flex items-center space-x-2">
                                {account.profileData?.profile?.picture?.data?.url && (
                                  <img
                                    src={account.profileData.profile.picture.data.url}
                                    alt={account.profileData.profile.name}
                                    className="w-6 h-6 rounded-full"
                                  />
                                )}
                                <span className="font-medium">Profile:</span>
                                <span>{account.profileData.profile.name}</span>
                              </div>
                            )}
                            {Array.isArray(account.profileData?.pages) && account.profileData.pages.length > 0 && (
                              <div>
                                <div className="font-medium mb-1">Pages:</div>
                                <ul className="list-disc pl-5 space-y-1">
                                  {account.profileData.pages.map((pg: any, idx: number) => (
                                    <li key={idx}>
                                      <span className="font-medium">{pg.name}</span>
                                      {pg.category && <span className="ml-2 text-gray-500">({pg.category})</span>}
                                      {Array.isArray(pg.category_list) && pg.category_list.length > 0 && (
                                        <div className="mt-1 text-gray-500">Categories: {pg.category_list.map((c: any) => c.name).join(', ')}</div>
                                      )}
                                      {Array.isArray(pg.tasks) && pg.tasks.length > 0 && (
                                        <div className="mt-1 text-gray-500">Permissions: {pg.tasks.join(', ')}</div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {account.profileData?.lastRefreshed && (
                              <div>
                                <span className="font-medium">Last Refreshed:</span> {new Date(account.profileData.lastRefreshed).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">No additional details available.</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={() => connectAccount(platform)}
                    className={`w-full ${config.color} text-white`}
                    disabled={config.disabled}
                  >
                    {config.disabled ? 'Coming Soon' : 'Connect Account'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {accounts.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Connected Accounts Summary</CardTitle>
            <CardDescription>
              Overview of your connected social media accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {accounts.filter(acc => acc.isActive).length}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Active Connections</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {accounts.length}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Total Platforms</div>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {accounts.filter(acc => acc.expiresAt && new Date(acc.expiresAt) < new Date()).length}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">Need Refresh</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 text-center">
        <Button
          onClick={() => router.push('/dashboard/content/create')}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Start Creating Content
        </Button>
      </div>
    </div>
  );
}
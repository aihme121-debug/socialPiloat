'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database, 
  Facebook, 
  Globe, 
  RefreshCw, 
  Server, 
  Wifi,
  Filter,
  Trash2,
  Download,
  Play,
  Square,
  TestTube,
  Settings,
  Zap,
  MessageSquare,
  Webhook,
  Link,
  Eye,
  Send,
  RotateCcw,
  Power,
  Radio,
  Signal,
  ActivitySquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface SystemLog {
  timestamp: string;
  category: 'facebook' | 'socket' | 'ngrok' | 'server' | 'system' | 'webhook' | 'api';
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  details?: Record<string, any>;
}

interface SystemStatus {
  facebook: {
    webhook: {
      connected: boolean;
      lastConnection: string;
      disconnectReason?: string;
      reconnectAttempts: number;
      errorCount: number;
      verifyToken?: string;
      callbackUrl?: string;
    };
    api: {
      status: 'connected' | 'disconnected' | 'error';
      lastResponse: string;
      responseTime?: number;
      errorMessage?: string;
      appId?: string;
      rateLimit?: {
        remaining: number;
        total: number;
        reset: number;
      };
    };
  };
  socket: {
    server: {
      running: boolean;
      connections: number;
      uptime: number;
      port: number;
    };
    connections: Array<{
      id: string;
      connectedAt: string;
      lastActivity: string;
      disconnectReason?: string;
    }>;
  };
  ngrok: {
    tunnel: {
      active: boolean;
      url?: string;
      establishedAt?: string;
      lastError?: string;
      restartCount: number;
    };
  };
  server: {
    uptime: number;
    port: number;
    restartCount: number;
    lastRestart: string;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

interface WebhookTestPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text: string;
        attachments?: Array<any>;
      };
      postback?: {
        payload: string;
        title: string;
      };
    }>;
  }>;
}

export default function AdminDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  
  // Advanced testing states
  const [webhookTestPayload, setWebhookTestPayload] = useState<string>('');
  const [graphApiEndpoint, setGraphApiEndpoint] = useState<string>('me');
  const [graphApiParams, setGraphApiParams] = useState<string>('fields=id,name,email');
  const [testPageId, setTestPageId] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('Hello from Admin Dashboard!');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [isConnectingWebhook, setIsConnectingWebhook] = useState(false);
  const [isConnectingApi, setIsConnectingApi] = useState(false);
  const [realtimeLogs, setRealtimeLogs] = useState<SystemLog[]>([]);
  const [showRealtimeLogs, setShowRealtimeLogs] = useState(true);
  
  // Facebook Page Subscription states
  const [pageAccessToken, setPageAccessToken] = useState<string>('');
  const [pageId, setPageId] = useState<string>('');
  const [tokenScopes, setTokenScopes] = useState<string[]>([]);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [subscriptionError, setSubscriptionError] = useState<string>('');
  const [subscriptionErrorDetails, setSubscriptionErrorDetails] = useState<any>(null);

  // Enhanced status fetching
  const fetchSystemStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/system-status');
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      toast.error('Failed to fetch system status');
    }
  }, []);

  // Enhanced logs fetching
  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedLevel !== 'all') params.append('level', selectedLevel);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`/api/admin/logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      toast.error('Failed to fetch logs');
    }
  }, [selectedCategory, selectedLevel, searchTerm]);

  // Webhook connection control
  const connectWebhook = async () => {
    setIsConnectingWebhook(true);
    try {
      const response = await fetch('/api/admin/facebook/webhook/connect', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        toast.success('Facebook webhook connected successfully');
        fetchSystemStatus();
      } else {
        toast.error(`Webhook connection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to connect webhook');
      console.error('Webhook connection error:', error);
    } finally {
      setIsConnectingWebhook(false);
    }
  };

  const disconnectWebhook = async () => {
    setIsConnectingWebhook(true);
    try {
      const response = await fetch('/api/admin/facebook/webhook/disconnect', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        toast.success('Facebook webhook disconnected');
        fetchSystemStatus();
      } else {
        toast.error(`Webhook disconnection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to disconnect webhook');
      console.error('Webhook disconnection error:', error);
    } finally {
      setIsConnectingWebhook(false);
    }
  };

  // API connection control
  const connectApi = async () => {
    setIsConnectingApi(true);
    try {
      const response = await fetch('/api/admin/facebook/api/connect', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        toast.success('Facebook API connected successfully');
        fetchSystemStatus();
      } else {
        toast.error(`API connection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to connect API');
      console.error('API connection error:', error);
    } finally {
      setIsConnectingApi(false);
    }
  };

  const disconnectApi = async () => {
    setIsConnectingApi(true);
    try {
      const response = await fetch('/api/admin/facebook/api/disconnect', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        toast.success('Facebook API disconnected');
        fetchSystemStatus();
      } else {
        toast.error(`API disconnection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to disconnect API');
      console.error('API disconnection error:', error);
    } finally {
      setIsConnectingApi(false);
    }
  };

  // Webhook testing
  const testWebhook = async () => {
    setIsTestingWebhook(true);
    try {
      let payload: WebhookTestPayload;
      
      if (webhookTestPayload.trim()) {
        // Use custom payload
        payload = JSON.parse(webhookTestPayload);
      } else {
        // Use default test payload
        payload = {
          object: 'page',
          entry: [{
            id: testPageId || '123456789',
            time: Date.now(),
            messaging: [{
              sender: { id: '987654321' },
              recipient: { id: testPageId || '123456789' },
              timestamp: Date.now(),
              message: {
                mid: `test_msg_${Date.now()}`,
                text: testMessage
              }
            }]
          }]
        };
      }

      const response = await fetch('/api/admin/facebook/webhook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pageId: testPageId || '123456789',
          message: testMessage,
          payload 
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Webhook test sent successfully');
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'webhook',
          level: 'info',
          message: 'Webhook test payload sent',
          details: { payload, result }
        }, ...prev.slice(0, 99)]);
      } else {
        toast.error(`Webhook test failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to test webhook');
      console.error('Webhook test error:', error);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Graph API testing
  const testGraphApi = async () => {
    setIsTestingApi(true);
    try {
      const response = await fetch('/api/admin/facebook/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: graphApiEndpoint,
          params: graphApiParams
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Graph API test successful');
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'api',
          level: 'info',
          message: 'Graph API test completed',
          details: { endpoint: graphApiEndpoint, result }
        }, ...prev.slice(0, 99)]);
      } else {
        toast.error(`Graph API test failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Failed to test Graph API');
      console.error('Graph API test error:', error);
    } finally {
      setIsTestingApi(false);
    }
  };

  // Check Facebook token permissions
  const checkTokenPermissions = async () => {
    if (!pageAccessToken) {
      toast.error('Please enter a Page Access Token');
      return;
    }

    setIsCheckingToken(true);
    try {
      const response = await fetch('/api/admin/facebook/token/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pageAccessToken })
      });

      const result = await response.json();
      
      if (result.success) {
        // Extract permissions from the response
        const permissions = result.permissions?.data?.map((perm: any) => perm.permission) || [];
        setTokenScopes(permissions);
        setTokenInfo(result);
        
        toast.success('Token permissions checked successfully');
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'api',
          level: 'info',
          message: 'Token permissions checked',
          details: { permissions: permissions.length, debug: result.debug }
        }, ...prev.slice(0, 99)]);
      } else {
        toast.error(`Token check failed: ${result.error}`);
        setTokenScopes([]);
        setTokenInfo(null);
      }
    } catch (error) {
      toast.error('Failed to check token permissions');
      console.error('Token permissions check error:', error);
      setTokenScopes([]);
      setTokenInfo(null);
    } finally {
      setIsCheckingToken(false);
    }
  };

  // Subscribe to Facebook page
  const subscribeToPage = async () => {
    if (!pageAccessToken || !pageId) {
      toast.error('Please enter both Page ID and Access Token');
      return;
    }

    setIsSubscribing(true);
    setSubscriptionError('');
    setSubscriptionErrorDetails(null);
    
    try {
      const response = await fetch('/api/admin/facebook/page/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pageId: pageId,
          token: pageAccessToken 
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(result.alreadySubscribed ? 'App is already subscribed to this page' : 'Successfully subscribed to page webhook events');
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'webhook',
          level: 'info',
          message: result.alreadySubscribed ? `Page ${pageId} already subscribed` : `Subscribed to page ${pageId} webhook events`,
          details: { pageId, result: result.data }
        }, ...prev.slice(0, 99)]);
        
        // Clear any previous errors
        setSubscriptionError('');
        setSubscriptionErrorDetails(null);
        
        // Refresh system status to update webhook connection
        fetchSystemStatus();
      } else {
        const errorMessage = result.error || 'Page subscription failed';
        setSubscriptionError(errorMessage);
        setSubscriptionErrorDetails(result.details || result.facebookError || null);
        
        toast.error(errorMessage);
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'webhook',
          level: 'error',
          message: `Failed to subscribe to page ${pageId}`,
          details: { 
            pageId, 
            error: errorMessage,
            details: result.details,
            facebookError: result.facebookError
          }
        }, ...prev.slice(0, 99)]);
      }
    } catch (error) {
      const errorMessage = 'Failed to subscribe to page';
      setSubscriptionError(errorMessage);
      setSubscriptionErrorDetails({ error: error instanceof Error ? error.message : 'Unknown error' });
      
      toast.error(errorMessage);
      console.error('Page subscription error:', error);
      setRealtimeLogs(prev => [{
        timestamp: new Date().toISOString(),
        category: 'webhook',
        level: 'error',
        message: 'Page subscription error',
        details: { pageId, error: error instanceof Error ? error.message : 'Unknown error' }
      }, ...prev.slice(0, 99)]);
    } finally {
      setIsSubscribing(false);
    }
  };

  // Clear logs
  const clearLogs = async () => {
    try {
      const response = await fetch('/api/admin/logs', { method: 'DELETE' });
      if (response.ok) {
        setLogs([]);
        setRealtimeLogs([]);
        toast.success('Logs cleared successfully');
      }
    } catch (error) {
      toast.error('Failed to clear logs');
      console.error('Failed to clear logs:', error);
    }
  };

  // Export logs
  const exportLogs = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      systemStatus,
      logs: filteredLogs,
      exportInfo: {
        totalLogs: filteredLogs.length,
        filteredBy: {
          category: selectedCategory,
          level: selectedLevel,
          search: searchTerm
        }
      }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-logs-${new Date().toISOString()}.json`;
    link.click();
    toast.success('Logs exported successfully');
  };

  // Enhanced Socket.IO connection setup
  useEffect(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const socketInstance = io(base + '/admin', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      withCredentials: true,
      path: '/socket.io'
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to admin namespace');
      setSocketConnected(true);
      toast.success('Connected to admin dashboard');
      
      // Request initial status
      socketInstance.emit('get-system-status');
      socketInstance.emit('get-system-logs');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Disconnected from admin namespace:', reason);
      setSocketConnected(false);
      toast.warning('Disconnected from admin dashboard');
    });

    // Listen for real-time status updates
    socketInstance.on('system-status', (data) => {
      if (data.status) {
        setSystemStatus(data.status);
      }
    });

    // Listen for real-time log updates
    socketInstance.on('system-logs', (data) => {
      if (data.logs) {
        setLogs(data.logs);
      }
    });

    // Listen for new log events
    socketInstance.on('new-log', (data) => {
      if (data.log && showRealtimeLogs) {
        setRealtimeLogs(prev => [data.log, ...prev.slice(0, 99)]);
      }
    });

    // Listen for specific Facebook events
    socketInstance.on('facebook-webhook', (data) => {
      if (showRealtimeLogs) {
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'facebook',
          level: data.connected ? 'info' : 'warn',
          message: `Facebook webhook ${data.connected ? 'connected' : 'disconnected'}`,
          details: data
        }, ...prev.slice(0, 99)]);
      }
    });

    socketInstance.on('facebook-api-connected', (data) => {
      if (showRealtimeLogs) {
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'api',
          level: 'info',
          message: 'Facebook API connected',
          details: data
        }, ...prev.slice(0, 99)]);
      }
    });

    socketInstance.on('facebook-api-error', (data) => {
      if (showRealtimeLogs) {
        setRealtimeLogs(prev => [{
          timestamp: new Date().toISOString(),
          category: 'api',
          level: 'error',
          message: 'Facebook API error',
          details: data
        }, ...prev.slice(0, 99)]);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [showRealtimeLogs]);

  // Auto refresh system status
  useEffect(() => {
    if (!autoRefresh) return;
    if (socketConnected) return;

    const interval = setInterval(() => {
      fetchSystemStatus();
      fetchLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, socketConnected, fetchSystemStatus, fetchLogs]);

  // Initial fetch
  useEffect(() => {
    fetchSystemStatus();
    fetchLogs();
    setLoading(false);
  }, [fetchSystemStatus, fetchLogs]);

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm]);

  // Format functions
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatMemory = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'fatal': return 'bg-red-600';
      case 'error': return 'bg-red-500';
      case 'warn': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      case 'debug': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'facebook': return <Facebook className="h-4 w-4" />;
      case 'webhook': return <Webhook className="h-4 w-4" />;
      case 'api': return <Radio className="h-4 w-4" />;
      case 'socket': return <Wifi className="h-4 w-4" />;
      case 'ngrok': return <Globe className="h-4 w-4" />;
      case 'server': return <Server className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getConnectionStatusColor = (connected: boolean) => {
    return connected ? 'bg-green-500' : 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              System Command Center
            </h1>
            <p className="text-slate-400 mt-2">Advanced monitoring and control dashboard</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex gap-3"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`border-slate-600 text-slate-300 hover:bg-slate-700 ${autoRefresh ? 'animate-pulse' : ''}`}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRealtimeLogs(!showRealtimeLogs)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <ActivitySquare className="h-4 w-4 mr-2" />
              {showRealtimeLogs ? 'Hide' : 'Show'} Live Logs
            </Button>
          </motion.div>
        </div>

        {/* Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {/* Facebook Webhook Control */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Facebook Webhook
              </CardTitle>
              <motion.div
                animate={{ scale: systemStatus?.facebook?.webhook?.connected ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.6, repeat: systemStatus?.facebook?.webhook?.connected ? Infinity : 0, repeatDelay: 2 }}
                className={`w-3 h-3 rounded-full ${getConnectionStatusColor(systemStatus?.facebook?.webhook?.connected || false)}`}
              />
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-2xl font-bold"
              >
                {systemStatus?.facebook?.webhook?.connected ? 'Connected' : 'Disconnected'}
              </motion.div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={connectWebhook}
                  disabled={isConnectingWebhook || systemStatus?.facebook?.webhook?.connected}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Connect
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={disconnectWebhook}
                  disabled={isConnectingWebhook || !systemStatus?.facebook?.webhook?.connected}
                  className="flex-1"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Disconnect
                </Button>
              </div>
              
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>Errors: {systemStatus?.facebook?.webhook?.errorCount || 0}</p>
                <p>Reconnects: {systemStatus?.facebook?.webhook?.reconnectAttempts || 0}</p>
                <p>Last: {systemStatus?.facebook?.webhook?.lastConnection ? 
                  new Date(systemStatus.facebook.webhook.lastConnection).toLocaleTimeString() : 'Never'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Facebook API Control */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Facebook Graph API
              </CardTitle>
              <motion.div
                animate={{ scale: systemStatus?.facebook?.api?.status === 'connected' ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.6, repeat: systemStatus?.facebook?.api?.status === 'connected' ? Infinity : 0, repeatDelay: 2 }}
                className={`w-3 h-3 rounded-full ${
                  systemStatus?.facebook?.api?.status === 'connected' ? 'bg-green-500' :
                  systemStatus?.facebook?.api?.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}
              />
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-2xl font-bold"
              >
                {systemStatus?.facebook?.api?.status || 'Unknown'}
              </motion.div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  onClick={connectApi}
                  disabled={isConnectingApi || systemStatus?.facebook?.api?.status === 'connected'}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Connect
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={disconnectApi}
                  disabled={isConnectingApi || systemStatus?.facebook?.api?.status !== 'connected'}
                  className="flex-1"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Disconnect
                </Button>
              </div>
              
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>Response: {systemStatus?.facebook?.api?.responseTime ? `${systemStatus.facebook.api.responseTime}ms` : 'N/A'}</p>
                <p>Last: {systemStatus?.facebook?.api?.lastResponse ? 
                  new Date(systemStatus.facebook.api.lastResponse).toLocaleTimeString() : 'Never'}</p>
                {systemStatus?.facebook?.api?.rateLimit && (
                  <p>Rate Limit: {systemStatus.facebook.api.rateLimit.remaining}/{systemStatus.facebook.api.rateLimit.total}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Socket.IO Status */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Socket.IO Server
              </CardTitle>
              <motion.div
                animate={{ scale: systemStatus?.socket?.server?.running ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.6, repeat: systemStatus?.socket?.server?.running ? Infinity : 0, repeatDelay: 2 }}
                className={`w-3 h-3 rounded-full ${getConnectionStatusColor(systemStatus?.socket?.server?.running || false)}`}
              />
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-2xl font-bold"
              >
                {systemStatus?.socket?.server?.running ? 'Running' : 'Stopped'}
              </motion.div>
              
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>Port: {systemStatus?.socket?.server?.port || 'N/A'}</p>
                <p>Connections: {systemStatus?.socket?.server?.connections || 0}</p>
                <p>Uptime: {systemStatus?.socket?.server?.running ? 
                  formatUptime(systemStatus.socket.server.uptime) : 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Real-time Connection */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Signal className="h-4 w-4" />
                Dashboard Connection
              </CardTitle>
              <motion.div
                animate={{ scale: socketConnected ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.6, repeat: socketConnected ? Infinity : 0, repeatDelay: 2 }}
                className={`w-3 h-3 rounded-full ${getConnectionStatusColor(socketConnected)}`}
              />
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-2xl font-bold"
              >
                {socketConnected ? 'Connected' : 'Disconnected'}
              </motion.div>
              
              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>Real-time Updates: {socketConnected ? 'Active' : 'Inactive'}</p>
                <p>Socket.IO: {systemStatus?.socket?.server?.running ? 'Active' : 'Inactive'}</p>
                <p>Last Update: {new Date().toLocaleTimeString()}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Testing and Tools Section */}
        <Tabs defaultValue="testing" className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="testing" className="data-[state=active]:bg-slate-700">
              <TestTube className="h-4 w-4 mr-2" />
              Testing Tools
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-700">
              <Activity className="h-4 w-4 mr-2" />
              System Logs
            </TabsTrigger>
            <TabsTrigger value="diagnostics" className="data-[state=active]:bg-slate-700">
            <Settings className="h-4 w-4 mr-2" />
            Diagnostics
          </TabsTrigger>
          <TabsTrigger value="facebook" className="data-[state=active]:bg-slate-700">
            <Facebook className="h-4 w-4 mr-2" />
            Facebook Integration
          </TabsTrigger>
        </TabsList>

          <TabsContent value="testing" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Webhook Testing */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Webhook Testing
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Test Facebook webhook with custom or predefined payloads
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Test Page ID</label>
                    <Input
                      placeholder="Enter Facebook Page ID"
                      value={testPageId}
                      onChange={(e) => setTestPageId(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Test Message</label>
                    <Input
                      placeholder="Enter test message"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Custom Payload (JSON)</label>
                    <Textarea
                      placeholder="Enter custom webhook payload (optional)"
                      value={webhookTestPayload}
                      onChange={(e) => setWebhookTestPayload(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 min-h-[100px]"
                    />
                  </div>
                  
                  <Button 
                    onClick={testWebhook}
                    disabled={isTestingWebhook}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {isTestingWebhook ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4 mr-2" />
                        Test Webhook
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Graph API Testing */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Graph API Testing
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Test Facebook Graph API endpoints
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">API Endpoint</label>
                    <Input
                      placeholder="me, page-id, etc."
                      value={graphApiEndpoint}
                      onChange={(e) => setGraphApiEndpoint(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Parameters</label>
                    <Input
                      placeholder="fields=id,name,email"
                      value={graphApiParams}
                      onChange={(e) => setGraphApiParams(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                    />
                  </div>
                  
                  <Button 
                    onClick={testGraphApi}
                    disabled={isTestingApi}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isTestingApi ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="h-4 w-4 mr-2" />
                        Test Graph API
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Facebook Page Subscription Panel */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Facebook className="h-5 w-5" />
                  Facebook Page Subscription
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Connect your Facebook Page to receive real-time webhook events and messages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Token Input Section */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Page Access Token</label>
                      <Input
                        placeholder="Enter your Facebook Page Access Token"
                        value={pageAccessToken}
                        onChange={(e) => setPageAccessToken(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                        type="password"
                      />
                      <p className="text-xs text-slate-400">
                        Required permissions: pages_manage_posts, pages_read_engagement, pages_messaging, pages_show_list
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Page ID</label>
                      <Input
                        placeholder="Enter your Facebook Page ID"
                        value={pageId}
                        onChange={(e) => setPageId(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      />
                    </div>
                    
                    <Button 
                      onClick={checkTokenPermissions}
                      disabled={isCheckingToken || !pageAccessToken}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                      {isCheckingToken ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Check Token Permissions
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Token Scopes Display */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Token Scopes</label>
                      <div className="min-h-[100px] p-3 bg-slate-900/50 rounded-md border border-slate-700">
                        {tokenScopes.length > 0 ? (
                          <div className="space-y-2">
                            {tokenScopes.map((scope, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-400" />
                                <span className="text-xs text-slate-300">{scope}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No permissions found. Check token to see scopes.</p>
                        )}
                      </div>
                    </div>
                    
                    {tokenInfo && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Token Info</label>
                        <div className="p-3 bg-slate-900/50 rounded-md border border-slate-700 text-xs text-slate-400">
                          <div className="space-y-1">
                            <p><strong>App ID:</strong> {tokenInfo.debug?.data?.app_id || 'N/A'}</p>
                            <p><strong>Type:</strong> {tokenInfo.debug?.data?.type || 'N/A'}</p>
                            <p><strong>Expires:</strong> {tokenInfo.debug?.data?.expires_at ? new Date(tokenInfo.debug.data.expires_at * 1000).toLocaleString() : 'Never'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Display */}
                {subscriptionError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg"
                  >
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-red-300">{subscriptionError}</p>
                        
                        {subscriptionErrorDetails && (
                          <div className="space-y-2">
                            {subscriptionErrorDetails.suggestion && (
                              <p className="text-xs text-red-200">💡 {subscriptionErrorDetails.suggestion}</p>
                            )}
                            
                            {subscriptionErrorDetails.requiredPermissions && (
                              <div>
                                <p className="text-xs text-red-200 font-medium mb-1">Required Permissions:</p>
                                <div className="flex flex-wrap gap-1">
                                  {subscriptionErrorDetails.requiredPermissions.map((perm: string, index: number) => (
                                    <Badge key={index} variant="outline" className="text-xs border-red-600 text-red-300">
                                      {perm}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {subscriptionErrorDetails.troubleshooting && (
                              <div className="mt-3">
                                <p className="text-xs text-red-200 font-medium mb-1">Troubleshooting Steps:</p>
                                <ol className="text-xs text-red-200 space-y-1 list-decimal list-inside">
                                  {subscriptionErrorDetails.troubleshooting.map((step: string, index: number) => (
                                    <li key={index}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            
                            {subscriptionErrorDetails.pageId && (
                              <p className="text-xs text-red-200 mt-2">Page ID: {subscriptionErrorDetails.pageId}</p>
                            )}
                          </div>
                        )}
                        
                        {subscriptionErrorDetails?.facebookError && (
                          <details className="mt-2">
                            <summary className="text-xs text-red-300 cursor-pointer hover:text-red-200">
                              View Technical Details
                            </summary>
                            <pre className="text-xs text-red-200 mt-2 bg-red-950/50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(subscriptionErrorDetails.facebookError, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Subscribe Button */}
                <div className="border-t border-slate-700 pt-4">
                  <Button 
                    onClick={subscribeToPage}
                    disabled={isSubscribing || !pageAccessToken || !pageId || tokenScopes.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isSubscribing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Subscribing...
                      </>
                    ) : (
                      <>
                        <Link className="h-4 w-4 mr-2" />
                        Subscribe Page to Webhook Events
                      </>
                    )}
                  </Button>
                  
                  {tokenScopes.length === 0 && pageAccessToken && (
                    <p className="text-xs text-yellow-400 mt-2">
                      ⚠️ Please check token permissions first to ensure your token has the required scopes.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {/* Real-time Logs */}
            {showRealtimeLogs && (
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Real-time Event Stream
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Live system events and webhook/API activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px] w-full rounded-md border border-slate-700 bg-slate-900/50">
                    <div className="p-4 space-y-2">
                      <AnimatePresence>
                        {realtimeLogs.map((log, index) => (
                          <motion.div
                            key={`${log.timestamp}-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="flex items-start space-x-3 p-2 rounded-lg hover:bg-slate-800/50"
                          >
                            <div className={`w-2 h-2 rounded-full mt-2 ${getLevelColor(log.level)}`} />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-slate-400">
                                  {formatTimestamp(log.timestamp)}
                                </span>
                                <Badge variant="outline" className="text-xs border-slate-600">
                                  {getCategoryIcon(log.category)}
                                  <span className="ml-1">{log.category}</span>
                                </Badge>
                                <Badge className={`text-xs ${getLevelColor(log.level)} border-0`}>
                                  {log.level.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-300">{log.message}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {realtimeLogs.length === 0 && (
                        <div className="text-center text-slate-500 py-8">
                          No real-time events yet...
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* System Logs */}
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Logs
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Complete system event history with advanced filtering
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Advanced Filters */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <Input
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                      />
                    </div>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[150px] bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="api">API</SelectItem>
                        <SelectItem value="socket">Socket.IO</SelectItem>
                        <SelectItem value="ngrok">ngrok</SelectItem>
                        <SelectItem value="server">Server</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                      <SelectTrigger className="w-[120px] bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="fatal">Fatal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={exportLogs} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearLogs} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>

                  {/* Logs Display */}
                  <ScrollArea className="h-[400px] w-full rounded-md border border-slate-700 bg-slate-900/50">
                    <div className="p-4 space-y-2">
                      {filteredLogs.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                          No logs found matching your filters
                        </div>
                      ) : (
                        filteredLogs.map((log, index) => (
                          <motion.div
                            key={`${log.timestamp}-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-slate-800/50 border border-slate-700/50"
                          >
                            <div className={`w-2 h-2 rounded-full mt-2 ${getLevelColor(log.level)}`} />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center space-x-2 flex-wrap">
                                <span className="text-xs text-slate-400">
                                  {formatTimestamp(log.timestamp)}
                                </span>
                                <Badge variant="outline" className="text-xs border-slate-600">
                                  {getCategoryIcon(log.category)}
                                  <span className="ml-1">{log.category}</span>
                                </Badge>
                                <Badge className={`text-xs ${getLevelColor(log.level)} border-0`}>
                                  {log.level.toUpperCase()}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-300">{log.message}</p>
                              {log.details && (
                                <motion.pre
                                  initial={{ height: 0 }}
                                  animate={{ height: "auto" }}
                                  className="text-xs text-slate-400 bg-slate-900/70 p-3 rounded overflow-x-auto border border-slate-700"
                                >
                                  {JSON.stringify(log.details, null, 2)}
                                </motion.pre>
                              )}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Connection Diagnostics */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Connection Diagnostics
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    System connection health and troubleshooting
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(systemStatus?.facebook?.webhook?.connected || false)}`} />
                        <span className="text-sm font-medium">Webhook Connection</span>
                      </div>
                      <Badge variant={systemStatus?.facebook?.webhook?.connected ? 'default' : 'destructive'}>
                        {systemStatus?.facebook?.webhook?.connected ? 'Healthy' : 'Failed'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(systemStatus?.facebook?.api?.status === 'connected')}`} />
                        <span className="text-sm font-medium">Graph API Connection</span>
                      </div>
                      <Badge variant={
                        systemStatus?.facebook?.api?.status === 'connected' ? 'default' :
                        systemStatus?.facebook?.api?.status === 'error' ? 'destructive' : 'secondary'
                      }>
                        {systemStatus?.facebook?.api?.status === 'connected' ? 'Healthy' :
                         systemStatus?.facebook?.api?.status === 'error' ? 'Error' : 'Unknown'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor(socketConnected)}`} />
                        <span className="text-sm font-medium">Dashboard Connection</span>
                      </div>
                      <Badge variant={socketConnected ? 'default' : 'destructive'}>
                        {socketConnected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Quick Actions</h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset Connections
                      </Button>
                      <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Health */}
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    System Health
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Overall system performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Server Uptime</span>
                      <span className="text-sm font-mono text-slate-400">
                        {systemStatus?.server ? formatUptime(systemStatus.server.uptime) : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Memory Usage</span>
                      <span className="text-sm font-mono text-slate-400">
                        {systemStatus?.server?.memory ? 
                          `${(systemStatus.server.memory.percentage).toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Active Connections</span>
                      <span className="text-sm font-mono text-slate-400">
                        {systemStatus?.socket?.server?.connections || 0}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">Total Logs</span>
                      <span className="text-sm font-mono text-slate-400">
                        {logs.length}
                      </span>
                    </div>
                  </div>
                  
                  <div className="w-full bg-slate-900/50 rounded-full h-2 border border-slate-700">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${systemStatus?.server?.memory?.percentage || 0}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                    />
                  </div>
                  <div className="text-xs text-slate-500 text-center">
                    Memory: {systemStatus?.server?.memory ? formatMemory(systemStatus.server.memory.used) : 'N/A'} / 
                    {systemStatus?.server?.memory ? formatMemory(systemStatus.server.memory.total) : 'N/A'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Facebook Integration Tab */}
          <TabsContent value="facebook" className="space-y-4">
            <div className="grid gap-6">
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Facebook className="h-5 w-5" />
                    Multi-Tenant Facebook Integration
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Manage Facebook accounts and pages for secure multi-tenant integration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-white">Facebook OAuth Integration</h4>
                        <p className="text-sm text-slate-400">Connect Facebook accounts with encrypted token storage</p>
                      </div>
                      <Button 
                        onClick={() => window.location.href = '/admin/facebook-integration'}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Facebook className="h-4 w-4 mr-2" />
                        Manage Integration
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium">Connected Accounts</span>
                        </div>
                        <p className="text-2xl font-bold text-white">0</p>
                        <p className="text-xs text-slate-400">Active Facebook accounts</p>
                      </div>
                      
                      <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-green-400" />
                          <span className="text-sm font-medium">Connected Pages</span>
                        </div>
                        <p className="text-2xl font-bold text-white">0</p>
                        <p className="text-xs text-slate-400">Pages with access</p>
                      </div>
                      
                      <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="h-4 w-4 text-purple-400" />
                          <span className="text-sm font-medium">Webhook Events</span>
                        </div>
                        <p className="text-2xl font-bold text-white">0</p>
                        <p className="text-xs text-slate-400">Events processed</p>
                      </div>
                    </div>

                    <Alert className="bg-slate-700/50 border-slate-600">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Multi-Tenant Features</AlertTitle>
                      <AlertDescription className="text-slate-300">
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          <li>Secure OAuth flow with encrypted token storage</li>
                          <li>Per-user Facebook account management</li>
                          <li>Individual page access tokens and permissions</li>
                          <li>Webhook subscription management per page</li>
                          <li>Token refresh and rotation automation</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
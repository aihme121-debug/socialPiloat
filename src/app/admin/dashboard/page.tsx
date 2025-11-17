'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Download
} from 'lucide-react';

interface SystemLog {
  timestamp: string;
  category: 'facebook' | 'socket' | 'ngrok' | 'server' | 'system';
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
    };
    api: {
      status: 'connected' | 'disconnected' | 'error';
      lastResponse: string;
      responseTime?: number;
      errorMessage?: string;
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

export default function AdminDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch system status
  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/admin/system-status');
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    }
  };

  // Fetch system logs
  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedLevel !== 'all') params.append('level', selectedLevel);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`/api/admin/system-logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setFilteredLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  // Clear logs
  const clearLogs = async () => {
    try {
      const response = await fetch('/api/admin/system-logs', { method: 'DELETE' });
      if (response.ok) {
        setLogs([]);
        setFilteredLogs([]);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  // Export logs
  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-logs-${new Date().toISOString()}.json`;
    link.click();
  };

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchSystemStatus();
      fetchLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedCategory, selectedLevel, searchTerm]);

  // Initial fetch
  useEffect(() => {
    fetchSystemStatus();
    fetchLogs();
    setLoading(false);
  }, []);

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

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
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
      case 'socket': return <Wifi className="h-4 w-4" />;
      case 'ngrok': return <Globe className="h-4 w-4" />;
      case 'server': return <Server className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Admin Dashboard</h1>
          <p className="text-muted-foreground">Monitor system health and logs</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Server Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStatus?.server ? 'Running' : 'Stopped'}
            </div>
            <p className="text-xs text-muted-foreground">
              Port: {systemStatus?.server?.port || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">
              Uptime: {systemStatus?.server ? formatUptime(systemStatus.server.uptime) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facebook Webhook</CardTitle>
            <Facebook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                systemStatus?.facebook?.webhook?.connected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm">
                {systemStatus?.facebook?.webhook?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Errors: {systemStatus?.facebook?.webhook?.errorCount || 0}
            </p>
            <p className="text-xs text-muted-foreground">
              Reconnects: {systemStatus?.facebook?.webhook?.reconnectAttempts || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Socket.IO</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                systemStatus?.socket?.server?.running ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm">
                {systemStatus?.socket?.server?.running ? 'Running' : 'Stopped'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Connections: {systemStatus?.socket?.server?.connections || 0}
            </p>
            <p className="text-xs text-muted-foreground">
              Port: {systemStatus?.socket?.server?.port || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ngrok Tunnel</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${
                systemStatus?.ngrok?.tunnel?.active ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm">
                {systemStatus?.ngrok?.tunnel?.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {systemStatus?.ngrok?.tunnel?.url || 'No URL'}
            </p>
            <p className="text-xs text-muted-foreground">
              Restarts: {systemStatus?.ngrok?.tunnel?.restartCount || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Status */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
          <TabsTrigger value="facebook">Facebook Status</TabsTrigger>
          <TabsTrigger value="socket">Socket.IO Status</TabsTrigger>
          <TabsTrigger value="server">Server Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>
                Real-time system event logs with filtering capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="socket">Socket.IO</SelectItem>
                      <SelectItem value="ngrok">ngrok</SelectItem>
                      <SelectItem value="server">Server</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="fatal">Fatal</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportLogs}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearLogs}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>

                {/* Logs */}
                <ScrollArea className="h-[400px] w-full rounded-md border">
                  <div className="p-4 space-y-2">
                    {filteredLogs.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No logs found
                      </div>
                    ) : (
                      filteredLogs.map((log, index) => (
                        <div key={index} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                          <div className={`w-2 h-2 rounded-full mt-2 ${getLevelColor(log.level)}`} />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(log.timestamp)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getCategoryIcon(log.category)}
                                <span className="ml-1">{log.category}</span>
                              </Badge>
                              <Badge className={`text-xs ${getLevelColor(log.level)}`}>
                                {log.level.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm">{log.message}</p>
                            {log.details && (
                              <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facebook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Facebook Integration Status</CardTitle>
              <CardDescription>Detailed Facebook API and webhook status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Webhook Status:</span>
                  <Badge variant={systemStatus?.facebook?.webhook?.connected ? 'default' : 'destructive'}>
                    {systemStatus?.facebook?.webhook?.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>API Status:</span>
                  <Badge variant={
                    systemStatus?.facebook?.api?.status === 'connected' ? 'default' :
                    systemStatus?.facebook?.api?.status === 'error' ? 'destructive' : 'secondary'
                  }>
                    {systemStatus?.facebook?.api?.status || 'Unknown'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last Connection: {systemStatus?.facebook?.webhook?.lastConnection ? 
                    formatTimestamp(systemStatus.facebook.webhook.lastConnection) : 'Never'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Error Count: {systemStatus?.facebook?.webhook?.errorCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Reconnect Attempts: {systemStatus?.facebook?.webhook?.reconnectAttempts || 0}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="socket" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Socket.IO Status</CardTitle>
              <CardDescription>Real-time connection monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Server Status:</span>
                  <Badge variant={systemStatus?.socket?.server?.running ? 'default' : 'destructive'}>
                    {systemStatus?.socket?.server?.running ? 'Running' : 'Stopped'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Connections:</span>
                  <span className="font-semibold">{systemStatus?.socket?.server?.connections || 0}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Server Uptime: {systemStatus?.socket?.server?.running ? 
                    formatUptime(systemStatus.socket.server.uptime) : 'N/A'}
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">Recent Connections</h4>
                  {systemStatus?.socket?.connections?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active connections</p>
                  ) : (
                    <div className="space-y-2">
                      {systemStatus?.socket?.connections?.map((conn) => (
                        <div key={conn.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm font-mono">{conn.id}</span>
                          <span className="text-xs text-muted-foreground">
                            Connected: {formatTimestamp(conn.connectedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="server" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Statistics</CardTitle>
              <CardDescription>Server performance and resource usage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Server Port:</span>
                  <span className="font-semibold">{systemStatus?.server?.port || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Restart Count:</span>
                  <span className="font-semibold">{systemStatus?.server?.restartCount || 0}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last Restart: {systemStatus?.server?.lastRestart ? 
                    formatTimestamp(systemStatus.server.lastRestart) : 'Never'}
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">Memory Usage</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used Memory:</span>
                      <span>{systemStatus?.server?.memory ? 
                        formatMemory(systemStatus.server.memory.used) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Memory:</span>
                      <span>{systemStatus?.server?.memory ? 
                        formatMemory(systemStatus.server.memory.total) : 'N/A'}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${systemStatus?.server?.memory?.percentage || 0}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      {systemStatus?.server?.memory?.percentage?.toFixed(1) || 0}% used
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
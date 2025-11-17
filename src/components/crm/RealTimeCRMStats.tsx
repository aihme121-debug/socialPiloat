'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSocket } from '@/hooks/useSocket';
import { formatDistanceToNow } from 'date-fns';
import { 
  Users, 
  TrendingUp, 
  Star, 
  MessageSquare, 
  Calendar,
  Tag,
  Activity
} from 'lucide-react';

interface CRMStats {
  totalCustomers: number;
  newCustomers: number;
  highScoreCustomers: number;
  totalPosts: number;
  totalEngagement: number;
  recentMessages: number;
  conversionRate: number;
  avgCustomerScore: number;
  tagDistribution: { tag: string; count: number }[];
  topPerformers: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    score: number;
    tags: string[];
  }[];
}

interface RealTimeUpdate {
  type: 'new_customer' | 'message_received' | 'score_updated' | 'tag_added';
  data: any;
  timestamp: Date;
}

export function RealTimeCRMStats() {
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<RealTimeUpdate[]>([]);
  const { socket, isConnected } = useSocket({});

  // Fetch initial stats
  useEffect(() => {
    fetchStats();
  }, []);

  // Handle real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNewCustomer = (data: any) => {
      setStats(prev => prev ? {
        ...prev,
        totalCustomers: prev.totalCustomers + 1,
        newCustomers: prev.newCustomers + 1
      } : null);
      
      addUpdate({
        type: 'new_customer',
        data,
        timestamp: new Date()
      });
    };

    const handleMessageReceived = (data: any) => {
      setStats(prev => prev ? {
        ...prev,
        recentMessages: prev.recentMessages + 1
      } : null);
      
      addUpdate({
        type: 'message_received',
        data,
        timestamp: new Date()
      });
    };

    const handleScoreUpdated = (data: any) => {
      setStats(prev => prev ? {
        ...prev,
        topPerformers: prev.topPerformers.map(performer => 
          performer.customerId === data.customerId 
            ? { ...performer, score: data.newScore }
            : performer
        ).sort((a, b) => b.score - a.score)
      } : null);
      
      addUpdate({
        type: 'score_updated',
        data,
        timestamp: new Date()
      });
    };

    socket.on('new-customer', handleNewCustomer);
    socket.on('message-received', handleMessageReceived);
    socket.on('score-updated', handleScoreUpdated);

    return () => {
      socket.off('new-customer', handleNewCustomer);
      socket.off('message-received', handleMessageReceived);
      socket.off('score-updated', handleScoreUpdated);
    };
  }, [socket]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/crm/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching CRM stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const addUpdate = (update: RealTimeUpdate) => {
    setUpdates(prev => [update, ...prev].slice(0, 10)); // Keep only last 10 updates
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'new_customer': return <Users className="w-4 h-4" />;
      case 'message_received': return <MessageSquare className="w-4 h-4" />;
      case 'score_updated': return <Star className="w-4 h-4" />;
      case 'tag_added': return <Tag className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getUpdateColor = (type: string) => {
    switch (type) {
      case 'new_customer': return 'bg-blue-100 text-blue-800';
      case 'message_received': return 'bg-green-100 text-green-800';
      case 'score_updated': return 'bg-yellow-100 text-yellow-800';
      case 'tag_added': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No CRM data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className={isConnected ? 'text-green-700' : 'text-red-700'}>
          {isConnected ? 'Live Updates Active' : 'Disconnected'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.newCustomers} new this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Value Leads</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.highScoreCustomers}</div>
            <p className="text-xs text-muted-foreground">
              Score above 70
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentMessages}</div>
            <p className="text-xs text-muted-foreground">
              This week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              High-score customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Customers with highest lead scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topPerformers.map((performer, index) => (
              <div key={performer.customerId} className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {performer.customerName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{performer.customerName}</p>
                    <p className="text-xs text-muted-foreground">{performer.customerEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{performer.score}</Badge>
                  {performer.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Updates */}
      {updates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Real-time Activity
            </CardTitle>
            <CardDescription>Recent customer interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {updates.map((update, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className={`p-2 rounded-full ${getUpdateColor(update.type)}`}>
                    {getUpdateIcon(update.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">
                      {update.type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(update.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
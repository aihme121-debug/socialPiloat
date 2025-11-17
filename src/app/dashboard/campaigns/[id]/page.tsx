'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  Target, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Share2, 
  Heart,
  Play,
  Pause,
  Edit,
  Trash2,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  name: string;
  description: string;
  objective: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  platforms: string[];
  targetAudience: any;
  contentStrategy: any;
  metrics: {
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    totalEngagement: number;
    averageEngagement: string;
  };
  createdAt: string;
}

interface Post {
  id: string;
  platform: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt: string | null;
  publishedAt: string | null;
  content: string;
  media: any[];
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${params.id}`);
      const data = await response.json();
      if (response.ok) {
        setCampaign(data.campaign);
        setPosts(data.posts || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch campaign',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch campaign',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchCampaign();
    }
  }, [params.id]);

  const updateCampaignStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/campaigns/${params.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (response.ok) {
        setCampaign(prev => prev ? { ...prev, status: newStatus as any } : null);
        toast({
          title: 'Success',
          description: `Campaign ${newStatus}`
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update campaign status',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update campaign status',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getObjectiveLabel = (objective: string) => {
    const objectives = {
      brand_awareness: 'Brand Awareness',
      engagement: 'Engagement',
      lead_generation: 'Lead Generation',
      conversions: 'Conversions',
      app_installs: 'App Installs',
      website_traffic: 'Website Traffic'
    };
    return objectives[objective as keyof typeof objectives] || objective;
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      facebook: 'bg-blue-100 text-blue-800',
      twitter: 'bg-sky-100 text-sky-800',
      linkedin: 'bg-blue-100 text-blue-700',
      instagram: 'bg-pink-100 text-pink-800',
      tiktok: 'bg-purple-100 text-purple-800',
      youtube: 'bg-red-100 text-red-800'
    };
    return colors[platform as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const engagementRate = campaign?.metrics?.totalPosts && campaign.metrics.totalPosts > 0 
    ? ((campaign.metrics.totalEngagement / campaign.metrics.totalPosts) * 100).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Campaign not found</h2>
          <Button onClick={() => router.push('/dashboard/campaigns')} className="mt-4">
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            <p className="text-gray-600">{campaign.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getStatusColor(campaign.status)}>
            {campaign.status}
          </Badge>
          {campaign.status === 'draft' && (
            <Button onClick={() => updateCampaignStatus('active')}>
              <Play className="w-4 h-4 mr-2" />
              Start Campaign
            </Button>
          )}
          {campaign.status === 'active' && (
            <Button variant="outline" onClick={() => updateCampaignStatus('paused')}>
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button onClick={() => updateCampaignStatus('active')}>
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Campaign Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Objective</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{getObjectiveLabel(campaign.objective)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {campaign.budget ? `$${campaign.budget.toLocaleString()}` : 'No budget set'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {campaign.startDate && campaign.endDate
                ? `${new Date(campaign.startDate).toLocaleDateString()} - ${new Date(campaign.endDate).toLocaleDateString()}`
                : 'No dates set'
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{engagementRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Details */}
      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Posts ({campaign.metrics.totalPosts})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="targeting">Targeting</TabsTrigger>
          <TabsTrigger value="strategy">Content Strategy</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Campaign Posts</h3>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Post
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <Badge className={getPlatformColor(post.platform)}>
                      {post.platform}
                    </Badge>
                    <Badge variant="outline">{post.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {post.content}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Scheduled:</span>
                      <span>{post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString() : 'Not scheduled'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Published:</span>
                      <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Not published'}</span>
                    </div>
                  </div>
                  {post.status === 'published' && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Heart className="w-4 h-4 mr-1" />
                          {post.engagement.likes}
                        </span>
                        <span className="flex items-center">
                          <MessageSquare className="w-4 h-4 mr-1" />
                          {post.engagement.comments}
                        </span>
                        <span className="flex items-center">
                          <Share2 className="w-4 h-4 mr-1" />
                          {post.engagement.shares}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {posts.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">No posts created for this campaign yet.</p>
                <Button className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Post
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.metrics.totalPosts}</div>
                <Progress value={(campaign.metrics.publishedPosts / campaign.metrics.totalPosts) * 100} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {campaign.metrics.publishedPosts} published, {campaign.metrics.scheduledPosts} scheduled
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.metrics.totalEngagement.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all platforms
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Engagement</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.metrics.averageEngagement}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per post
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Platforms</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaign.platforms.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Active platforms
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="targeting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
              <CardDescription>Define who you want to reach with this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Demographics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Age Range</p>
                      <p className="font-medium">{campaign.targetAudience?.ageRange || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Gender</p>
                      <p className="font-medium">{campaign.targetAudience?.gender || 'All'}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {campaign.targetAudience?.interests?.map((interest: string, index: number) => (
                      <Badge key={index} variant="secondary">{interest}</Badge>
                    )) || <p className="text-gray-500">No interests specified</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Strategy</CardTitle>
              <CardDescription>Guidelines for content creation and posting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Tone of Voice</h4>
                  <p className="text-gray-700">{campaign.contentStrategy?.tone || 'Not specified'}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Posting Frequency</h4>
                  <p className="text-gray-700">{campaign.contentStrategy?.frequency || 'Not specified'}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Content Themes</h4>
                  <div className="flex flex-wrap gap-2">
                    {campaign.contentStrategy?.themes?.map((theme: string, index: number) => (
                      <Badge key={index} variant="secondary">{theme}</Badge>
                    )) || <p className="text-gray-500">No themes specified</p>}
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
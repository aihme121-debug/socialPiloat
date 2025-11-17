'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Plus, Calendar, DollarSign, Users, Target, TrendingUp, MessageSquare, Share2, Heart } from 'lucide-react';
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
  metrics: {
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    totalEngagement: number;
    averageEngagement: string;
  };
  createdAt: string;
}

interface CampaignForm {
  name: string;
  description: string;
  objective: string;
  budget: string;
  startDate: string;
  endDate: string;
  platforms: string[];
  targetAudience: {
    ageRange: string;
    gender: string;
    interests: string[];
  };
  contentStrategy: {
    tone: string;
    frequency: string;
    themes: string[];
  };
}

export default function CampaignsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CampaignForm>({
    name: '',
    description: '',
    objective: 'brand_awareness',
    budget: '',
    startDate: '',
    endDate: '',
    platforms: [],
    targetAudience: {
      ageRange: '',
      gender: 'all',
      interests: []
    },
    contentStrategy: {
      tone: 'professional',
      frequency: 'daily',
      themes: []
    }
  });

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      const data = await response.json();
      if (response.ok) {
        setCampaigns(data.campaigns);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch campaigns',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch campaigns',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const createCampaign = async () => {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          objective: formData.objective,
          budget: formData.budget ? parseFloat(formData.budget) : null,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          platforms: formData.platforms,
          targetAudience: formData.targetAudience,
          contentStrategy: formData.contentStrategy
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Campaign created successfully'
        });
        setCreateDialogOpen(false);
        fetchCampaigns();
        // Reset form
        setFormData({
          name: '',
          description: '',
          objective: 'brand_awareness',
          budget: '',
          startDate: '',
          endDate: '',
          platforms: [],
          targetAudience: {
            ageRange: '',
            gender: 'all',
            interests: []
          },
          contentStrategy: {
            tone: 'professional',
            frequency: 'daily',
            themes: []
          }
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create campaign',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create campaign',
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

  const totalBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalEngagement = campaigns.reduce((sum, campaign) => sum + campaign.metrics.totalEngagement, 0);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Campaign Manager</h1>
          <p className="text-gray-600">Create and manage your social media campaigns</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Set up a new social media campaign with specific objectives and targeting
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Campaign Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter campaign name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="objective">Objective *</Label>
                    <Select
                      value={formData.objective}
                      onValueChange={(value) => setFormData({ ...formData, objective: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select objective" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brand_awareness">Brand Awareness</SelectItem>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="lead_generation">Lead Generation</SelectItem>
                        <SelectItem value="conversions">Conversions</SelectItem>
                        <SelectItem value="app_installs">App Installs</SelectItem>
                        <SelectItem value="website_traffic">Website Traffic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your campaign goals and strategy"
                    rows={3}
                  />
                </div>
              </div>

              {/* Budget and Schedule */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Budget and Schedule</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="budget">Budget ($)</Label>
                    <Input
                      id="budget"
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Platforms */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Platforms</h3>
                <div className="grid grid-cols-2 gap-4">
                  {['facebook', 'twitter', 'linkedin', 'instagram', 'tiktok', 'youtube'].map((platform) => (
                    <div key={platform} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={platform}
                        checked={formData.platforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, platforms: [...formData.platforms, platform] });
                          } else {
                            setFormData({ ...formData, platforms: formData.platforms.filter(p => p !== platform) });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={platform} className="capitalize">{platform}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createCampaign} disabled={!formData.name || !formData.objective || formData.platforms.length === 0}>
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
            <p className="text-xs text-muted-foreground">Active and completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Likes, comments, shares</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
          <CardDescription>Manage and track your social media campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Campaigns</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="paused">Paused</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Objective</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Posts</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-sm text-gray-500">
                            {campaign.startDate && new Date(campaign.startDate).toLocaleDateString()}
                            {campaign.endDate && ` - ${new Date(campaign.endDate).toLocaleDateString()}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getObjectiveLabel(campaign.objective)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {campaign.budget ? `$${campaign.budget.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {campaign.platforms.map((platform) => (
                            <Badge key={platform} variant="outline" className="capitalize">
                              {platform}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{campaign.metrics.publishedPosts} published</div>
                          <div className="text-gray-500">{campaign.metrics.scheduledPosts} scheduled</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{campaign.metrics.totalEngagement.toLocaleString()}</div>
                          <div className="text-gray-500">avg: {campaign.metrics.averageEngagement}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {campaigns.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No campaigns found. Create your first campaign to get started.
                </div>
              )}
            </TabsContent>
            
            {['active', 'paused', 'completed', 'draft'].map((status) => (
              <TabsContent key={status} value={status} className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Objective</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Platforms</TableHead>
                      <TableHead>Posts</TableHead>
                      <TableHead>Engagement</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.filter(c => c.status === status).map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{campaign.name}</div>
                            <div className="text-sm text-gray-500">
                              {campaign.startDate && new Date(campaign.startDate).toLocaleDateString()}
                              {campaign.endDate && ` - ${new Date(campaign.endDate).toLocaleDateString()}`}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getObjectiveLabel(campaign.objective)}</TableCell>
                        <TableCell>
                          {campaign.budget ? `$${campaign.budget.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {campaign.platforms.map((platform) => (
                              <Badge key={platform} variant="outline" className="capitalize">
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{campaign.metrics.publishedPosts} published</div>
                            <div className="text-gray-500">{campaign.metrics.scheduledPosts} scheduled</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{campaign.metrics.totalEngagement.toLocaleString()}</div>
                            <div className="text-gray-500">avg: {campaign.metrics.averageEngagement}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}>
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {campaigns.filter(c => c.status === status).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No {status} campaigns found.
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
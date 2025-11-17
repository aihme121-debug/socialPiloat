'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Filter, Search, TrendingUp, Users, DollarSign, Target } from 'lucide-react';

interface CRMLead {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: string;
  value: number;
  score: number;
  customer: {
    name: string;
    email?: string;
    company?: string;
  };
  assignedUser?: {
    name: string;
    avatar?: string;
  };
  createdAt: string;
}

interface CRMOpportunity {
  id: string;
  title: string;
  stage: string;
  probability: number;
  value: number;
  customer: {
    name: string;
  };
  expectedCloseDate?: string;
}

interface CRMStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  totalOpportunities: number;
  totalValue: number;
  weightedValue: number;
  conversionRate: number;
  avgDealSize: number;
}

export default function CRMDashboard() {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [opportunities, setOpportunities] = useState<CRMOpportunity[]>([]);
  const [stats, setStats] = useState<CRMStats>({
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    totalOpportunities: 0,
    totalValue: 0,
    weightedValue: 0,
    conversionRate: 0,
    avgDealSize: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLeads();
    fetchStats();
    fetchOpportunities();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/crm/leads?limit=10');
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/crm/stats');
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalLeads: data.totalLeads || 0,
          newLeads: data.newLeads || 0,
          qualifiedLeads: data.qualifiedLeads || 0,
          totalOpportunities: data.totalOpportunities || 0,
          totalValue: data.totalValue || 0,
          weightedValue: data.weightedValue || 0,
          conversionRate: data.conversionRate || 0,
          avgDealSize: data.avgDealSize || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchOpportunities = async () => {
    try {
      const response = await fetch('/api/crm/opportunities?limit=10');
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-500',
      CONTACTED: 'bg-yellow-500',
      QUALIFIED: 'bg-green-500',
      PROPOSAL: 'bg-purple-500',
      NEGOTIATION: 'bg-orange-500',
      CLOSED_WON: 'bg-green-600',
      CLOSED_LOST: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-gray-400',
      MEDIUM: 'bg-yellow-400',
      HIGH: 'bg-orange-400',
      URGENT: 'bg-red-400',
    };
    return colors[priority] || 'bg-gray-400';
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      PROSPECTING: 'bg-blue-500',
      QUALIFICATION: 'bg-yellow-500',
      NEEDS_ANALYSIS: 'bg-orange-500',
      VALUE_PROPOSITION: 'bg-purple-500',
      PROPOSAL_PRICE_QUOTE: 'bg-pink-500',
      NEGOTIATION_REVIEW: 'bg-red-500',
      CLOSED_WON: 'bg-green-600',
      CLOSED_LOST: 'bg-gray-500',
    };
    return colors[stage] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6 animate-pulse bg-white/10 backdrop-blur-md border-white/20">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">CRM Dashboard</h1>
          <p className="text-gray-400">Manage your leads and customer relationships</p>
        </div>
        <div className="flex gap-3">
          <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            New Lead
          </Button>
          <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Leads</p>
              <p className="text-3xl font-bold text-white">{stats.totalLeads}</p>
              <p className="text-sm text-green-400">+{stats.newLeads} new this week</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Qualified Leads</p>
              <p className="text-3xl font-bold text-white">{stats.qualifiedLeads}</p>
              <p className="text-sm text-blue-400">{stats.totalLeads > 0 ? ((stats.qualifiedLeads / stats.totalLeads) * 100).toFixed(1) : '0.0'}% of total</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Target className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Opportunities</p>
              <p className="text-3xl font-bold text-white">{stats.totalOpportunities}</p>
              <p className="text-sm text-purple-400">{stats.conversionRate.toFixed(1)}% conversion</p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white/10 backdrop-blur-md border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Pipeline Value</p>
              <p className="text-3xl font-bold text-white">৳{(stats.weightedValue / 1000000).toFixed(1)}M</p>
              <p className="text-sm text-orange-400">Avg deal: ৳{(stats.avgDealSize / 1000).toFixed(0)}K</p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Leads List */}
      <div className="grid gap-4">
        {leads.map((lead) => (
          <Card key={lead.id} className="p-6 bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-white">{lead.title}</h3>
                  <div className="flex gap-2">
                    <Badge className={`${getStatusColor(lead.status)} text-white text-xs`}>
                      {lead.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={`${getPriorityColor(lead.priority)} text-white text-xs`}>
                      {lead.priority}
                    </Badge>
                  </div>
                </div>
                <p className="text-gray-300 mb-3">{lead.customer.name}</p>
                {lead.customer.company && (
                  <p className="text-sm text-gray-400 mb-3">{lead.customer.company}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>Source: {lead.source}</span>
                  <span>Value: ৳{(lead.value / 1000).toFixed(0)}K</span>
                  <span>Score: {lead.score}/100</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  {lead.assignedUser && (
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {lead.assignedUser.name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Opportunities Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-white mb-4">Recent Opportunities</h2>
        <div className="grid gap-4">
          {opportunities.map((opportunity) => (
            <Card key={opportunity.id} className="p-6 bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{opportunity.title}</h3>
                    <Badge className={`${getStageColor(opportunity.stage)} text-white text-xs`}>
                      {opportunity.stage.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-gray-300 mb-3">{opportunity.customer.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>Probability: {opportunity.probability}%</span>
                    <span>Value: ৳{(opportunity.value / 1000).toFixed(0)}K</span>
                    {opportunity.expectedCloseDate && (
                      <span>Expected: {new Date(opportunity.expectedCloseDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
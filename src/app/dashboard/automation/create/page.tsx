'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface Condition {
  id: string;
  type: 'CONTENT_CONTAINS' | 'ENGAGEMENT_THRESHOLD' | 'TIME_CONDITION' | 'PLATFORM_CONDITION';
  field: string;
  operator: 'EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN' | 'BETWEEN';
  value: string | number;
  value2?: string | number; // For BETWEEN operator
}

interface Action {
  id: string;
  type: 'SEND_NOTIFICATION' | 'CREATE_CONTENT' | 'SCHEDULE_POST' | 'UPDATE_STATUS' | 'TRIGGER_WEBHOOK';
  config: Record<string, any>;
}

export default function CreateAutomationRulePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'TIME_BASED' | 'EVENT_BASED' | 'CONDITION_BASED'>('TIME_BASED');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | 'DRAFT'>('DRAFT');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const addCondition = () => {
    const newCondition: Condition = {
      id: Date.now().toString(),
      type: 'CONTENT_CONTAINS',
      field: 'content',
      operator: 'CONTAINS',
      value: '',
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const addAction = () => {
    const newAction: Action = {
      id: Date.now().toString(),
      type: 'SEND_NOTIFICATION',
      config: {},
    };
    setActions([...actions, newAction]);
  };

  const updateAction = (id: string, updates: Partial<Action>) => {
    setActions(actions.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const removeAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          triggerType,
          status,
          conditions,
          actions,
        }),
      });

      if (!response.ok) throw new Error('Failed to create rule');

      toast({
        title: 'Success',
        description: 'Automation rule created successfully',
      });

      router.push('/dashboard/automation');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create automation rule',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getConditionFieldOptions = (type: string) => {
    switch (type) {
      case 'CONTENT_CONTAINS':
        return [
          { value: 'content', label: 'Post Content' },
          { value: 'title', label: 'Post Title' },
          { value: 'hashtags', label: 'Hashtags' },
          { value: 'mentions', label: 'Mentions' },
        ];
      case 'ENGAGEMENT_THRESHOLD':
        return [
          { value: 'likes', label: 'Likes Count' },
          { value: 'comments', label: 'Comments Count' },
          { value: 'shares', label: 'Shares Count' },
          { value: 'engagement_rate', label: 'Engagement Rate' },
        ];
      case 'TIME_CONDITION':
        return [
          { value: 'post_time', label: 'Post Time' },
          { value: 'created_at', label: 'Created Time' },
          { value: 'scheduled_time', label: 'Scheduled Time' },
        ];
      case 'PLATFORM_CONDITION':
        return [
          { value: 'platform', label: 'Social Platform' },
          { value: 'account_type', label: 'Account Type' },
          { value: 'audience_size', label: 'Audience Size' },
        ];
      default:
        return [];
    }
  };

  const getActionConfigFields = (type: string) => {
    switch (type) {
      case 'SEND_NOTIFICATION':
        return [
          { name: 'recipient', label: 'Recipient', type: 'select', options: ['email', 'dashboard', 'both'] },
          { name: 'message', label: 'Message', type: 'textarea' },
        ];
      case 'CREATE_CONTENT':
        return [
          { name: 'content_type', label: 'Content Type', type: 'select', options: ['post', 'story', 'reel'] },
          { name: 'template', label: 'Template', type: 'textarea' },
        ];
      case 'SCHEDULE_POST':
        return [
          { name: 'delay_hours', label: 'Delay (Hours)', type: 'number' },
          { name: 'platforms', label: 'Platforms', type: 'multi-select', options: ['facebook', 'instagram', 'twitter', 'linkedin'] },
        ];
      case 'UPDATE_STATUS':
        return [
          { name: 'status', label: 'Status', type: 'select', options: ['published', 'draft', 'scheduled'] },
        ];
      case 'TRIGGER_WEBHOOK':
        return [
          { name: 'url', label: 'Webhook URL', type: 'text' },
          { name: 'method', label: 'HTTP Method', type: 'select', options: ['POST', 'GET', 'PUT'] },
          { name: 'payload', label: 'Payload', type: 'textarea' },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/automation')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Automation Rule</h1>
            <p className="text-muted-foreground">Set up automated workflows for your social media management</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Define the basic properties of your automation rule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter rule name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this rule does"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="triggerType">Trigger Type *</Label>
              <Select value={triggerType} onValueChange={(value: any) => setTriggerType(value)}>
                <SelectTrigger id="triggerType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIME_BASED">Time-based (Scheduled)</SelectItem>
                  <SelectItem value="EVENT_BASED">Event-based (Triggered by events)</SelectItem>
                  <SelectItem value="CONDITION_BASED">Condition-based (When conditions are met)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Conditions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Conditions</CardTitle>
                <CardDescription>Define when this rule should be triggered</CardDescription>
              </div>
              <Button type="button" onClick={addCondition} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Condition
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {conditions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No conditions defined. Add a condition to trigger this rule.
              </div>
            ) : (
              <div className="space-y-4">
                {conditions.map((condition) => (
                  <Card key={condition.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label>Condition Type</Label>
                        <Select
                          value={condition.type}
                          onValueChange={(value: any) => updateCondition(condition.id, { type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONTENT_CONTAINS">Content Contains</SelectItem>
                            <SelectItem value="ENGAGEMENT_THRESHOLD">Engagement Threshold</SelectItem>
                            <SelectItem value="TIME_CONDITION">Time Condition</SelectItem>
                            <SelectItem value="PLATFORM_CONDITION">Platform Condition</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Field</Label>
                        <Select
                          value={condition.field}
                          onValueChange={(value: any) => updateCondition(condition.id, { field: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getConditionFieldOptions(condition.type).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Operator</Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value: any) => updateCondition(condition.id, { operator: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EQUALS">Equals</SelectItem>
                            <SelectItem value="CONTAINS">Contains</SelectItem>
                            <SelectItem value="GREATER_THAN">Greater Than</SelectItem>
                            <SelectItem value="LESS_THAN">Less Than</SelectItem>
                            <SelectItem value="BETWEEN">Between</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Value</Label>
                        <Input
                          value={condition.value as string}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                          placeholder="Enter value"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCondition(condition.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Define what should happen when this rule is triggered</CardDescription>
              </div>
              <Button type="button" onClick={addAction} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Action
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No actions defined. Add an action to perform when the rule is triggered.
              </div>
            ) : (
              <div className="space-y-4">
                {actions.map((action) => (
                  <Card key={action.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Action Type</Label>
                        <Select
                          value={action.type}
                          onValueChange={(value: any) => updateAction(action.id, { type: value, config: {} })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SEND_NOTIFICATION">Send Notification</SelectItem>
                            <SelectItem value="CREATE_CONTENT">Create Content</SelectItem>
                            <SelectItem value="SCHEDULE_POST">Schedule Post</SelectItem>
                            <SelectItem value="UPDATE_STATUS">Update Status</SelectItem>
                            <SelectItem value="TRIGGER_WEBHOOK">Trigger Webhook</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAction(action.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {getActionConfigFields(action.type).length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {getActionConfigFields(action.type).map((field) => (
                          <div key={field.name} className="space-y-2">
                            <Label>{field.label}</Label>
                            {field.type === 'select' && (
                              <Select
                                value={action.config[field.name] || ''}
                                onValueChange={(value: any) => updateAction(action.id, {
                                  config: { ...action.config, [field.name]: value }
                                })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.options?.map((option: string) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {field.type === 'textarea' && (
                              <Textarea
                                value={action.config[field.name] || ''}
                                onChange={(e) => updateAction(action.id, {
                                  config: { ...action.config, [field.name]: e.target.value }
                                })}
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                                rows={3}
                              />
                            )}
                            {(field.type === 'text' || field.type === 'number') && (
                              <Input
                                type={field.type}
                                value={action.config[field.name] || ''}
                                onChange={(e) => updateAction(action.id, {
                                  config: { ...action.config, [field.name]: e.target.value }
                                })}
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/automation')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Creating...' : 'Create Rule'}
          </Button>
        </div>
      </form>
    </div>
  );
}
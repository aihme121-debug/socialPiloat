'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
  }>;
  isActive: boolean;
  platform: string;
}

const triggerOptions = [
  { value: 'facebook_message', label: 'Facebook Message' },
  { value: 'facebook_comment', label: 'Facebook Comment' },
  { value: 'post_published', label: 'Post Published' },
  { value: 'campaign_completed', label: 'Campaign Completed' },
  { value: 'time_based', label: 'Time Based' },
];

const operatorOptions = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'regex', label: 'Regex Match' },
];

const actionTypes = [
  { value: 'send_message', label: 'Send Message' },
  { value: 'reply_comment', label: 'Reply to Comment' },
  { value: 'create_post', label: 'Create Post' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'webhook', label: 'Webhook Call' },
];

export default function AutomationEditPage() {
  const router = useRouter();
  const params = useParams();
  const ruleId = params.id as string;
  
  const [rule, setRule] = useState<AutomationRule>({
    id: ruleId,
    name: '',
    description: '',
    trigger: 'facebook_message',
    conditions: [{ field: '', operator: 'equals', value: '' }],
    actions: [{ type: 'send_message', config: { message: '' } }],
    isActive: true,
    platform: 'facebook',
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (ruleId !== 'new') {
      fetchRule();
    } else {
      setIsLoading(false);
    }
  }, [ruleId]);

  const fetchRule = async () => {
    try {
      const response = await fetch(`/api/automation/rules/${ruleId}`);
      if (response.ok) {
        const data = await response.json();
        setRule(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch automation rule',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch automation rule',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const url = ruleId === 'new' ? '/api/automation/rules' : `/api/automation/rules/${ruleId}`;
      const method = ruleId === 'new' ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rule),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Automation rule ${ruleId === 'new' ? 'created' : 'updated'} successfully`,
        });
        router.push('/dashboard/automation');
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.message || 'Failed to save automation rule',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save automation rule',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;
    
    try {
      const response = await fetch(`/api/automation/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Automation rule deleted successfully',
        });
        router.push('/dashboard/automation');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete automation rule',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete automation rule',
        variant: 'destructive',
      });
    }
  };

  const addCondition = () => {
    setRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }]
    }));
  };

  const removeCondition = (index: number) => {
    setRule(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const updateCondition = (index: number, field: string, value: string) => {
    setRule(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => 
        i === index ? { ...condition, [field]: value } : condition
      )
    }));
  };

  const addAction = () => {
    setRule(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'send_message', config: { message: '' } }]
    }));
  };

  const removeAction = (index: number) => {
    setRule(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const updateAction = (index: number, config: Record<string, any>) => {
    setRule(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, config } : action
      )
    }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {ruleId === 'new' ? 'Create Automation Rule' : 'Edit Automation Rule'}
          </CardTitle>
          <CardDescription>
            Set up automated actions based on triggers and conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={rule.name}
                onChange={(e) => setRule(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter rule name"
              />
            </div>
            <div>
              <Label htmlFor="trigger">Trigger</Label>
              <Select
                value={rule.trigger}
                onValueChange={(value) => setRule(prev => ({ ...prev, trigger: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={rule.description}
              onChange={(e) => setRule(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this rule does"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={rule.isActive}
              onCheckedChange={(checked) => setRule(prev => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Enable this rule</Label>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Conditions</h3>
              <Button onClick={addCondition} size="sm" variant="outline">
                Add Condition
              </Button>
            </div>
            {rule.conditions.map((condition, index) => (
              <div key={index} className="flex gap-2 items-end">
                <Input
                  placeholder="Field"
                  value={condition.field}
                  onChange={(e) => updateCondition(index, 'field', e.target.value)}
                />
                <Select
                  value={condition.operator}
                  onValueChange={(value) => updateCondition(index, 'operator', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCondition(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Actions</h3>
              <Button onClick={addAction} size="sm" variant="outline">
                Add Action
              </Button>
            </div>
            {rule.actions.map((action, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Select
                        value={action.type}
                        onValueChange={(value) => updateAction(index, { ...action.config, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {actionTypes.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAction(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {action.type === 'send_message' && (
                      <Textarea
                        placeholder="Message content"
                        value={action.config.message || ''}
                        onChange={(e) => updateAction(index, { ...action.config, message: e.target.value })}
                        rows={3}
                      />
                    )}
                    {action.type === 'reply_comment' && (
                      <Textarea
                        placeholder="Reply content"
                        value={action.config.reply || ''}
                        onChange={(e) => updateAction(index, { ...action.config, reply: e.target.value })}
                        rows={3}
                      />
                    )}
                    {action.type === 'webhook' && (
                      <Input
                        placeholder="Webhook URL"
                        value={action.config.url || ''}
                        onChange={(e) => updateAction(index, { ...action.config, url: e.target.value })}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-between">
            <div>
              {ruleId !== 'new' && (
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Rule
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Rule'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
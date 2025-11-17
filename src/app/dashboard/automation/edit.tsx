'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

export default function EditAutomationRulePage() {
  const [rule, setRule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  useEffect(() => {
    if (params?.id) {
      fetchRule();
    }
  }, [params?.id]);

  const fetchRule = async () => {
    try {
      const response = await fetch(`/api/automation/rules/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch rule');
      const data = await response.json();
      setRule(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch automation rule',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRule = (updates: any) => {
    if (rule) {
      setRule({ ...rule, ...updates });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rule) return;

    setSaving(true);

    try {
      const response = await fetch(`/api/automation/rules/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });

      if (!response.ok) throw new Error('Failed to update rule');

      toast({
        title: 'Success',
        description: 'Automation rule updated successfully',
      });

      router.push('/dashboard/automation');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update automation rule',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading rule...</p>
        </div>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Rule not found</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard/automation')}>
            Back to Automation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/dashboard/automation')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Automation Rule</h1>
            <p className="text-muted-foreground">Update your automated workflow settings</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Update the basic properties of your automation rule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={rule.name}
                  onChange={(e) => updateRule({ name: e.target.value })}
                  placeholder="Enter rule name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={rule.status} onValueChange={(value: any) => updateRule({ status: value })}>
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
                value={rule.description}
                onChange={(e) => updateRule({ description: e.target.value })}
                placeholder="Describe what this rule does"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="triggerType">Trigger Type *</Label>
              <Select value={rule.triggerType} onValueChange={(value: any) => updateRule({ triggerType: value })}>
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

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/automation')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
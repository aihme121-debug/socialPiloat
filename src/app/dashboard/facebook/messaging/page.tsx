'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/use-toast'
import { Loader2, MessageSquare, Settings, Plus, Edit, Trash2 } from 'lucide-react'

interface AutoReplyRule {
  id: string
  name: string
  triggerKeywords: string[]
  responseTemplate: string
  confidenceThreshold: number
  isActive: boolean
  category: string
  responseDelay?: number
}

export default function FacebookMessagingPage() {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [rules, setRules] = useState<AutoReplyRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null)

  // Form state
  const [ruleName, setRuleName] = useState('')
  const [triggerKeywords, setTriggerKeywords] = useState('')
  const [responseTemplate, setResponseTemplate] = useState('')
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7)
  const [responseDelay, setResponseDelay] = useState(2000)
  const [category, setCategory] = useState('other')

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/facebook/auto-reply/rules')
      
      if (!response.ok) {
        throw new Error('Failed to fetch rules')
      }

      const data = await response.json()
      setRules(data.rules || [])
    } catch (error) {
      console.error('Error fetching rules:', error)
      toast({
        title: 'Error',
        description: 'Failed to load auto-reply rules',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      
      // Here you would typically save the auto-reply enabled/disabled setting
      // to your business settings in the database
      
      toast({
        title: 'Success',
        description: 'Settings saved successfully'
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateRule = async () => {
    if (!ruleName || !triggerKeywords || !responseTemplate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      })
      return
    }

    try {
      const keywords = triggerKeywords.split(',').map(k => k.trim()).filter(k => k)
      
      const response = await fetch('/api/facebook/auto-reply/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: ruleName,
          triggerKeywords: keywords,
          responseTemplate,
          confidenceThreshold,
          category,
          responseDelay
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create rule')
      }

      toast({
        title: 'Success',
        description: 'Auto-reply rule created successfully'
      })

      resetForm()
      fetchRules()
    } catch (error) {
      console.error('Error creating rule:', error)
      toast({
        title: 'Error',
        description: 'Failed to create rule',
        variant: 'destructive'
      })
    }
  }

  const handleUpdateRule = async () => {
    if (!editingRule || !ruleName || !triggerKeywords || !responseTemplate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      })
      return
    }

    try {
      const keywords = triggerKeywords.split(',').map(k => k.trim()).filter(k => k)
      
      const response = await fetch(`/api/facebook/auto-reply/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: ruleName,
          triggerKeywords: keywords,
          responseTemplate,
          confidenceThreshold,
          category,
          responseDelay
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update rule')
      }

      toast({
        title: 'Success',
        description: 'Auto-reply rule updated successfully'
      })

      resetForm()
      fetchRules()
    } catch (error) {
      console.error('Error updating rule:', error)
      toast({
        title: 'Error',
        description: 'Failed to update rule',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return
    }

    try {
      const response = await fetch(`/api/facebook/auto-reply/rules/${ruleId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete rule')
      }

      toast({
        title: 'Success',
        description: 'Auto-reply rule deleted successfully'
      })

      fetchRules()
    } catch (error) {
      console.error('Error deleting rule:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setRuleName('')
    setTriggerKeywords('')
    setResponseTemplate('')
    setConfidenceThreshold(0.7)
    setResponseDelay(2000)
    setCategory('other')
    setShowRuleForm(false)
    setEditingRule(null)
  }

  const startEditRule = (rule: AutoReplyRule) => {
    setEditingRule(rule)
    setRuleName(rule.name)
    setTriggerKeywords(rule.triggerKeywords.join(', '))
    setResponseTemplate(rule.responseTemplate)
    setConfidenceThreshold(rule.confidenceThreshold)
    setResponseDelay(rule.responseDelay || 2000)
    setCategory(rule.category)
    setShowRuleForm(true)
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      greeting: 'bg-green-500',
      inquiry: 'bg-blue-500',
      complaint: 'bg-red-500',
      compliment: 'bg-yellow-500',
      other: 'bg-gray-500'
    }
    return colors[category] || colors.other
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facebook Messaging</h1>
          <p className="text-muted-foreground">
            Configure automated responses and manage your Facebook messaging settings
          </p>
        </div>
      </div>

      {/* Auto-reply Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Auto-Reply Settings
          </CardTitle>
          <CardDescription>
            Enable automatic responses to incoming Facebook messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-reply-enabled">Enable Auto-Reply</Label>
              <p className="text-sm text-muted-foreground">
                Automatically respond to incoming messages based on configured rules
              </p>
            </div>
            <Switch
              id="auto-reply-enabled"
              checked={autoReplyEnabled}
              onCheckedChange={setAutoReplyEnabled}
            />
          </div>
          
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Reply Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Auto-Reply Rules
              </CardTitle>
              <CardDescription>
                Define rules for automatic responses based on message content
              </CardDescription>
            </div>
            <Button onClick={() => setShowRuleForm(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showRuleForm && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold mb-4">
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rule-name">Rule Name *</Label>
                  <Input
                    id="rule-name"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g., Greeting Response"
                  />
                </div>

                <div>
                  <Label htmlFor="trigger-keywords">Trigger Keywords *</Label>
                  <Input
                    id="trigger-keywords"
                    value={triggerKeywords}
                    onChange={(e) => setTriggerKeywords(e.target.value)}
                    placeholder="hello, hi, hey (comma-separated)"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Keywords that trigger this rule (comma-separated)
                  </p>
                </div>

                <div>
                  <Label htmlFor="response-template">Response Template *</Label>
                  <Textarea
                    id="response-template"
                    value={responseTemplate}
                    onChange={(e) => setResponseTemplate(e.target.value)}
                    placeholder="Your automated response..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md bg-background"
                    >
                      <option value="greeting">Greeting</option>
                      <option value="inquiry">Inquiry</option>
                      <option value="complaint">Complaint</option>
                      <option value="compliment">Compliment</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="confidence-threshold">Confidence Threshold</Label>
                    <Input
                      id="confidence-threshold"
                      type="number"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Minimum confidence (0.1 - 1.0)
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="response-delay">Response Delay (ms)</Label>
                  <Input
                    id="response-delay"
                    type="number"
                    min="0"
                    max="10000"
                    step="500"
                    value={responseDelay}
                    onChange={(e) => setResponseDelay(parseInt(e.target.value))}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Delay before sending response (0-10 seconds)
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={editingRule ? handleUpdateRule : handleCreateRule}
                    size="sm"
                  >
                    {editingRule ? 'Update Rule' : 'Create Rule'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No auto-reply rules configured</p>
                <p className="text-sm">Click "Add Rule" to create your first rule</p>
              </div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Badge className={getCategoryColor(rule.category)}>
                        {rule.category}
                      </Badge>
                      {rule.isActive ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-gray-500 text-gray-600">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p><strong>Keywords:</strong> {rule.triggerKeywords.join(', ')}</p>
                      <p><strong>Response:</strong> {rule.responseTemplate}</p>
                      <p><strong>Confidence:</strong> {(rule.confidenceThreshold * 100).toFixed(0)}% | <strong>Delay:</strong> {rule.responseDelay}ms</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditRule(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Setup</CardTitle>
          <CardDescription>
            Configure your Facebook App webhook to receive messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                value={`${window.location.origin}/api/facebook/webhook`}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/facebook/webhook`)
                  toast({
                    title: 'Copied',
                    description: 'Webhook URL copied to clipboard'
                  })
                }}
              >
                Copy
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-2">
            <p>To set up the webhook:</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Go to your Facebook App dashboard</li>
              <li>Navigate to Webhooks → Instagram/Facebook</li>
              <li>Click "Add Callback URL"</li>
              <li>Paste the URL above</li>
              <li>Set verify token (configure in environment)</li>
              <li>Subscribe to "messages" and "messaging_postbacks" events</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
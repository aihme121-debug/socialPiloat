'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Send, 
  MessageSquare, 
  FileText, 
  Image, 
  Calendar,
  Clock,
  User,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FacebookPage {
  id: string
  facebookPageId: string
  name: string
  category: string
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  webhookSubscribed: boolean
}

interface FacebookActionsPanelProps {
  pages: FacebookPage[]
  accountId: string
}

export default function FacebookActionsPanel({ pages, accountId }: FacebookActionsPanelProps) {
  const [selectedPage, setSelectedPage] = useState<string>('')
  const [actionType, setActionType] = useState<'message' | 'post' | 'comment'>('message')
  const [recipientId, setRecipientId] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [postContent, setPostContent] = useState('')
  const [postType, setPostType] = useState<'text' | 'image' | 'video'>('text')
  const [scheduledTime, setScheduledTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; data?: any } | null>(null)
  const { toast } = useToast()

  const connectedPages = pages.filter(page => page.connectionStatus === 'CONNECTED')

  const handleSendMessage = async () => {
    if (!selectedPage || !recipientId || !messageContent.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a page, recipient, and enter a message',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/facebook/actions/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId,
          pageId: selectedPage,
          recipientId,
          message: messageContent,
          messageType: 'text'
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult({ success: true, message: 'Message sent successfully!', data: data.data })
        setMessageContent('')
        toast({
          title: 'Message Sent',
          description: 'Your message has been sent successfully',
          variant: 'default'
        })
      } else {
        setResult({ success: false, message: data.error || 'Failed to send message' })
        toast({
          title: 'Failed to Send Message',
          description: data.error || 'Failed to send message',
          variant: 'destructive'
        })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error occurred' })
      toast({
        title: 'Network Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePost = async () => {
    if (!selectedPage || !postContent.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a page and enter post content',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/facebook/actions/create-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId,
          pageId: selectedPage,
          content: postContent,
          postType,
          scheduledTime: scheduledTime || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult({ success: true, message: 'Post created successfully!', data: data.data })
        setPostContent('')
        setScheduledTime('')
        toast({
          title: 'Post Created',
          description: scheduledTime ? 'Post scheduled successfully!' : 'Post created successfully!',
          variant: 'default'
        })
      } else {
        setResult({ success: false, message: data.error || 'Failed to create post' })
        toast({
          title: 'Failed to Create Post',
          description: data.error || 'Failed to create post',
          variant: 'destructive'
        })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error occurred' })
      toast({
        title: 'Network Error',
        description: 'Failed to create post. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReplyToComment = async () => {
    if (!selectedPage || !recipientId || !messageContent.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please select a page, enter comment ID, and reply message',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/facebook/actions/reply-to-comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId,
          pageId: selectedPage,
          commentId: recipientId,
          reply: messageContent
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult({ success: true, message: 'Reply sent successfully!', data: data.data })
        setMessageContent('')
        toast({
          title: 'Reply Sent',
          description: 'Your reply has been sent successfully',
          variant: 'default'
        })
      } else {
        setResult({ success: false, message: data.error || 'Failed to reply to comment' })
        toast({
          title: 'Failed to Reply',
          description: data.error || 'Failed to reply to comment',
          variant: 'destructive'
        })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error occurred' })
      toast({
        title: 'Network Error',
        description: 'Failed to reply to comment. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Facebook Actions</CardTitle>
        <CardDescription>
          Send messages, create posts, and interact with your Facebook pages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Page Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Page</label>
            <Select value={selectedPage} onValueChange={setSelectedPage}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a Facebook page" />
              </SelectTrigger>
              <SelectContent>
                {connectedPages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    <div className="flex items-center space-x-2">
                      <span>{page.name}</span>
                      {page.webhookSubscribed && (
                        <Badge variant="default" className="text-xs bg-green-500">Subscribed</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {connectedPages.length === 0 && (
              <p className="text-sm text-muted-foreground">No connected pages available</p>
            )}
          </div>

          {/* Action Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Action Type</label>
            <Select value={actionType} onValueChange={(value: 'message' | 'post' | 'comment') => setActionType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="message">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Send Message</span>
                  </div>
                </SelectItem>
                <SelectItem value="post">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>Create Post</span>
                  </div>
                </SelectItem>
                <SelectItem value="comment">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Reply to Comment</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Forms */}
          {actionType === 'message' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Recipient ID</span>
                </label>
                <Input
                  placeholder="Enter Facebook User ID or Page Scoped ID"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Message Content</span>
                </label>
                <Textarea
                  placeholder="Enter your message here..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                />
              </div>
              <Button 
                onClick={handleSendMessage} 
                disabled={loading || !selectedPage}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          )}

          {actionType === 'post' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Post Type</span>
                </label>
                <Select value={postType} onValueChange={(value: 'text' | 'image' | 'video') => setPostType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4" />
                        <span>Text Post</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="image">
                      <div className="flex items-center space-x-2">
                        <Image className="h-4 w-4" />
                        <span>Image Post</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="video">
                      <div className="flex items-center space-x-2">
                        <Eye className="h-4 w-4" />
                        <span>Video Post</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Post Content</span>
                </label>
                <Textarea
                  placeholder="What's on your mind?"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>Schedule Post (Optional)</span>
                </label>
                <Input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
                {scheduledTime && (
                  <p className="text-xs text-muted-foreground">
                    Post will be scheduled for: {new Date(scheduledTime).toLocaleString()}
                  </p>
                )}
              </div>
              <Button 
                onClick={handleCreatePost} 
                disabled={loading || !selectedPage}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    {scheduledTime ? 'Schedule Post' : 'Create Post'}
                  </>
                )}
              </Button>
            </div>
          )}

          {actionType === 'comment' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Comment ID</span>
                </label>
                <Input
                  placeholder="Enter Facebook Comment ID"
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Reply Content</span>
                </label>
                <Textarea
                  placeholder="Enter your reply here..."
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                />
              </div>
              <Button 
                onClick={handleReplyToComment} 
                disabled={loading || !selectedPage}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Replying...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Reply to Comment
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Result Display */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert variant={result.success ? 'default' : 'destructive'}>
                  {result.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {result.message}
                    {result.data && (
                      <div className="mt-2 text-xs">
                        <p>ID: {result.data.id || 'N/A'}</p>
                        {result.data.url && (
                          <p>URL: <a href={result.data.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">View on Facebook</a></p>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}
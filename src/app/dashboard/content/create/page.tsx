'use client'

import { useState, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Calendar, Clock, Image, Send, Save, Facebook, Instagram, Twitter, Linkedin, Youtube, MessageSquare, Sparkles } from 'lucide-react'

const platforms = [
  { id: 'FACEBOOK', name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
  { id: 'INSTAGRAM', name: 'Instagram', icon: Instagram, color: 'bg-gradient-to-r from-purple-600 to-pink-600' },
  { id: 'TWITTER', name: 'Twitter', icon: Twitter, color: 'bg-blue-400' },
  { id: 'LINKEDIN', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
  { id: 'YOUTUBE', name: 'YouTube', icon: Youtube, color: 'bg-red-600' },
]

function ContentCreationContent() {
  const { user } = useAuth()
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [contentText, setContentText] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    )
  }

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setMediaFiles(prev => [...prev, ...files])
  }

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleAIGenerate = async () => {
    if (!contentText.trim()) return
    
    setIsGeneratingAI(true)
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: contentText,
          type: 'social_post',
          platforms: selectedPlatforms
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setContentText(data.content)
      }
    } catch (error) {
      console.error('AI generation error:', error)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handlePublish = async (publishNow: boolean = true) => {
    if (!contentText.trim() || selectedPlatforms.length === 0) {
      alert('Please add content and select at least one platform')
      return
    }

    const formData = new FormData()
    formData.append('contentText', contentText)
    formData.append('platforms', JSON.stringify(selectedPlatforms))
    formData.append('publishNow', publishNow.toString())
    
    if (!publishNow && scheduleDate && scheduleTime) {
      formData.append('scheduledAt', `${scheduleDate}T${scheduleTime}`)
    }
    
    mediaFiles.forEach(file => {
      formData.append('media', file)
    })

    try {
      if (publishNow) {
        setIsPublishing(true)
      } else {
        setIsScheduling(true)
      }

      const response = await fetch('/api/content/create', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        alert(publishNow ? 'Content published successfully!' : 'Content scheduled successfully!')
        // Reset form
        setContentText('')
        setSelectedPlatforms([])
        setMediaFiles([])
        setScheduleDate('')
        setScheduleTime('')
      } else {
        const error = await response.json()
        alert(`Error: ${error.message}`)
      }
    } catch (error) {
      console.error('Publish error:', error)
      alert('Failed to publish content')
    } finally {
      setIsPublishing(false)
      setIsScheduling(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Create Content
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Create and schedule engaging social media content
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content Creation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Platform Selection */}
            <div className="glass p-6 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Select Platforms</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {platforms.map((platform) => {
                  const Icon = platform.icon
                  const isSelected = selectedPlatforms.includes(platform.id)
                  return (
                    <button
                      key={platform.id}
                      onClick={() => handlePlatformToggle(platform.id)}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-8 h-8 ${platform.color} rounded flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium">{platform.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content Editor */}
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Content</h2>
                <button
                  onClick={handleAIGenerate}
                  disabled={!contentText.trim() || isGeneratingAI}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingAI ? 'Generating...' : 'AI Enhance'}
                </button>
              </div>
              
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full h-32 p-4 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Media</span>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 transition-colors"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Image className="w-6 h-6 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Add photos or videos</span>
                  </div>
                </button>
                
                {mediaFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {mediaFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="w-full h-20 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                          <span className="text-xs text-gray-500">{file.name.slice(0, 10)}...</span>
                        </div>
                        <button
                          onClick={() => removeMediaFile(index)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scheduling & Publishing */}
          <div className="space-y-6">
            {/* Schedule */}
            <div className="glass p-6 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Schedule
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="glass p-6 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Preview</h2>
              
              {selectedPlatforms.length === 0 ? (
                <p className="text-gray-500 text-sm">Select platforms to see preview</p>
              ) : (
                <div className="space-y-3">
                  {selectedPlatforms.map((platformId) => {
                    const platform = platforms.find(p => p.id === platformId)
                    if (!platform) return null
                    const Icon = platform.icon
                    
                    return (
                      <div key={platformId} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-6 h-6 ${platform.color} rounded flex items-center justify-center`}>
                            <Icon className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm font-medium">{platform.name}</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {contentText || 'Your content will appear here...'}
                        </div>
                        {mediaFiles.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            {mediaFiles.length} media file(s) attached
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handlePublish(true)}
                disabled={isPublishing || isScheduling || !contentText.trim() || selectedPlatforms.length === 0}
                className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isPublishing ? 'Publishing...' : 'Publish Now'}
              </button>
              
              <button
                onClick={() => handlePublish(false)}
                disabled={isPublishing || isScheduling || !contentText.trim() || selectedPlatforms.length === 0 || !scheduleDate || !scheduleTime}
                className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock className="w-4 h-4" />
                {isScheduling ? 'Scheduling...' : 'Schedule Post'}
              </button>
              
              <button
                disabled={!contentText.trim()}
                className="w-full flex items-center justify-center gap-2 p-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreateContentPage() {
  return (
    <ProtectedRoute>
      <ContentCreationContent />
    </ProtectedRoute>
  )
}
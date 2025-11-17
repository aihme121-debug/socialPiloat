'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useBusiness } from '@/hooks/use-business';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';

function AIDashboardContent() {
  const { data: session } = useSession();
  const { selectedBusiness } = useBusiness();
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);

  const generateContent = async () => {
    if (!prompt.trim() || !selectedBusiness) return;

    setLoading(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: selectedBusiness.id,
          type: 'POST',
          platform: 'FACEBOOK',
          prompt: prompt,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate content');

      const data = await response.json();
      setGeneratedContent(data.content);
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedBusiness) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Business Selected</h2>
          <p className="text-gray-500">Please select a business to use AI features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AI Assistant</h1>
          <p className="text-gray-600">Generate content and get AI-powered insights</p>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Content Generator</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">What do you want to create?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the content you want to generate..."
              rows={4}
              className="w-full p-3 bg-white/50 border border-white/30 rounded-lg focus:bg-white/80 transition-all resize-none outline-none"
            />
          </div>

          <button
            onClick={generateContent}
            disabled={!prompt.trim() || loading}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Generating...' : 'Generate Content'}
          </button>
        </div>

        {generatedContent && (
          <div className="bg-white/60 backdrop-blur-xl rounded-xl p-6 border border-white/20">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Generated Content</h3>
            <div className="bg-white/30 rounded-lg p-4">
              <p className="text-gray-800 whitespace-pre-wrap">{generatedContent}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIDashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <DashboardNav />
        <AIDashboardContent />
      </div>
    </ProtectedRoute>
  );
}
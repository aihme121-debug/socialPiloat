'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, ExternalLink, CheckCircle, AlertCircle, Info, Settings } from 'lucide-react';
import { toast } from 'sonner';
// Remove the useToast import since we're using sonner

interface FacebookConfig {
  currentConfig: {
    appId: string;
    redirectUri: string;
    environment: any;
  };
  facebookDeveloperSteps: any[];
  currentRedirectUris: string[];
  troubleshooting: any;
  testing: any;
  nextSteps: string[];
}

export default function FacebookSetupDashboard() {
  const [config, setConfig] = useState<FacebookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  // const { toast } = useToast(); // Not needed since we use sonner

  useEffect(() => {
    fetchFacebookConfig();
  }, []);

  const fetchFacebookConfig = async () => {
    try {
      const response = await fetch('/api/auth/social/facebook/setup');
      const data = await response.json();
      
      if (response.ok) {
        setConfig(data);
      } else {
        toast.error(data.error || 'Failed to fetch Facebook configuration');
      }
    } catch (error) {
      toast.error('Failed to connect to configuration service');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemId);
      setTimeout(() => setCopiedItem(null), 2000);
      toast.success('Text copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy text to clipboard');
    }
  };

  const openFacebookDevelopers = () => {
    window.open('https://developers.facebook.com/apps/', '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading Facebook configuration...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>
            Unable to load Facebook configuration. Please check your environment variables.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Facebook OAuth Setup</h1>
        <p className="text-gray-600">
          Configure your Facebook app to work with SocialPilot. Follow these steps to fix the "URL blocked" error.
        </p>
      </div>

      {/* Current Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="mr-2 h-5 w-5" />
            Current Configuration
          </CardTitle>
          <CardDescription>
            Your current Facebook OAuth settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">App ID</label>
              <div className="mt-1 flex items-center">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                  {config.currentConfig.appId || 'Not configured'}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(config.currentConfig.appId, 'appId')}
                  className="ml-2"
                >
                  {copiedItem === 'appId' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Redirect URI</label>
              <div className="mt-1 flex items-center">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 break-all">
                  {config.currentConfig.redirectUri}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(config.currentConfig.redirectUri, 'redirectUri')}
                  className="ml-2"
                >
                  {copiedItem === 'redirectUri' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Environment</label>
              <div className="mt-1">
                <Badge variant={config.currentConfig.environment?.ngrok ? 'default' : 'secondary'}>
                  {config.currentConfig.environment?.ngrok ? 'Ngrok Active' : 'Local Development'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Facebook Developer Console Setup
          </CardTitle>
          <CardDescription>
            Follow these steps to configure your Facebook app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {config.facebookDeveloperSteps.map((step) => (
              <div key={step.step} className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Step {step.step}: {step.title}
                  </h3>
                  <Badge variant="outline">Step {step.step}</Badge>
                </div>
                <p className="text-gray-600 mb-3">{step.description}</p>
                
                {step.domains && (
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-800 mb-2">App Domains to Add:</h4>
                    <div className="space-y-2">
                      {step.domains.map((domain: string) => (
                        <div key={domain} className="flex items-center">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                            {domain}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(domain, `domain-${domain}`)}
                            className="ml-2"
                          >
                            {copiedItem === `domain-${domain}` ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {step.redirectUris && (
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-800 mb-2">OAuth Redirect URIs to Add:</h4>
                    <div className="space-y-2">
                      {step.redirectUris.map((uri: string) => (
                        <div key={uri} className="flex items-center">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1 break-all">
                            {uri}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(uri, `uri-${uri}`)}
                            className="ml-2"
                          >
                            {copiedItem === `uri-${uri}` ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {step.settings && (
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-800 mb-2">Settings:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {step.settings.map((setting: string, index: number) => (
                        <li key={index} className="text-sm text-gray-600">{setting}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {step.products && (
                  <div className="mb-3">
                    <h4 className="font-medium text-gray-800 mb-2">Required Products:</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {step.products.map((product: string, index: number) => (
                        <li key={index} className="text-sm text-gray-600">{product}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {step.note && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> {step.note}
                    </p>
                  </div>
                )}
              </div>
            ))}
            
            <div className="flex justify-center pt-4">
              <Button onClick={openFacebookDevelopers} className="flex items-center">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Facebook Developers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redirect URIs to Copy */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Copy className="mr-2 h-5 w-5" />
            OAuth Redirect URIs to Add
          </CardTitle>
          <CardDescription>
            Copy these exact URLs to your Facebook app settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {config.currentRedirectUris.map((uri, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                <code className="text-sm flex-1 break-all">{uri}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(uri, `redirect-${index}`)}
                  className="ml-3"
                >
                  {copiedItem === `redirect-${index}` ? (
                    <><CheckCircle className="h-4 w-4 mr-1" /> Copied</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-1" /> Copy</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5" />
            Troubleshooting
          </CardTitle>
          <CardDescription>
            Common issues and solutions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.troubleshooting?.commonIssues?.map((issue: any, index: number) => (
              <div key={index} className="border-l-4 border-red-500 pl-4">
                <h4 className="font-medium text-gray-900 mb-1">{issue.issue}</h4>
                <p className="text-sm text-gray-600">{issue.solution}</p>
              </div>
            ))}
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Validation Steps:</h4>
              <ul className="list-disc pl-5 space-y-1">
                {config.troubleshooting?.validationSteps?.map((step: string, index: number) => (
                  <li key={index} className="text-sm text-yellow-700">{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" />
            Test Your Configuration
          </CardTitle>
          <CardDescription>
            Verify your Facebook OAuth setup is working
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <h4 className="font-medium text-green-800 mb-2">Test URL:</h4>
              <div className="flex items-center">
                <code className="bg-white px-2 py-1 rounded text-sm flex-1 break-all">
                  {config.testing?.directTestUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(config.testing?.directTestUrl, 'test-url')}
                  className="ml-2"
                >
                  {copiedItem === 'test-url' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              {config.testing?.instructions?.map((instruction: string, index: number) => (
                <div key={index} className="flex items-start">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2 py-1 rounded">
                    {index + 1}
                  </span>
                  <p className="text-sm text-gray-600">{instruction}</p>
                </div>
              ))}
            </div>
            
            <div className="flex justify-center pt-4">
              <Button 
                onClick={() => window.open('/dashboard/social-accounts', '_self')}
                variant="default"
                className="flex items-center"
              >
                Go to Social Accounts
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
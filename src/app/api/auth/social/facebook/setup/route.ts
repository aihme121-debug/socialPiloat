import { NextRequest, NextResponse } from 'next/server';
import dynamicOAuthConfig from '@/lib/social-media/oauth-config';

// Facebook App Configuration Helper
export async function GET(request: NextRequest) {
  try {
    const environmentInfo = dynamicOAuthConfig.getEnvironmentInfo();
    const facebookSettings = dynamicOAuthConfig.generateFacebookAppSettings();
    
    // Get current Facebook configuration
    const fbConfig = dynamicOAuthConfig.getConfigForProvider('facebook');
    
    if (!fbConfig) {
      return NextResponse.json({
        error: 'Facebook configuration not available',
        message: 'Please ensure FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are set in your environment variables'
      }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Facebook App Configuration Required Settings',
      currentConfig: {
        appId: fbConfig.clientId,
        redirectUri: fbConfig.redirectUri,
        environment: environmentInfo
      },
      facebookDeveloperSteps: [
        {
          step: 1,
          title: 'Go to Facebook Developers',
          description: 'Visit https://developers.facebook.com/apps/ and select your app',
          url: 'https://developers.facebook.com/apps/'
        },
        {
          step: 2,
          title: 'Configure App Domains',
          description: 'Go to Settings → Basic → App Domains and add:',
          domains: facebookSettings.appDomains,
          note: 'Add both localhost and your ngrok domain'
        },
        {
          step: 3,
          title: 'Configure OAuth Redirect URIs',
          description: 'Go to Facebook Login → Settings and add these URLs to "Valid OAuth Redirect URIs":',
          redirectUris: facebookSettings.oauthRedirectUris,
          note: 'Add all URLs - localhost for local development, ngrok for testing'
        },
        {
          step: 4,
          title: 'Enable Required Features',
          description: 'Ensure these settings are enabled:',
          settings: [
            'Client OAuth Login: Yes',
            'Web OAuth Login: Yes',
            'Enforce HTTPS: No (for local development)',
            'Embedded Browser OAuth Login: Yes',
            'Use Strict Mode for Redirect URIs: No'
          ]
        },
        {
          step: 5,
          title: 'Configure Advanced Settings',
          description: 'Go to Settings → Advanced and configure:',
          settings: [
            'Allow API Access to App: Yes',
            'Require App Secret: No (for OAuth)',
            'Require 2FA for App: Optional'
          ]
        },
        {
          step: 6,
          title: 'Add Products',
          description: 'Ensure these products are added to your app:',
          products: [
            'Facebook Login',
            'Webhooks',
            'Instagram Basic Display (if using Instagram)',
            'Instagram Graph API (if using Instagram Business)'
          ]
        }
      ],
      currentRedirectUris: [
        fbConfig.redirectUri,
        'http://localhost:3000/api/auth/social/facebook/callback',
        'https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback'
      ],
      troubleshooting: {
        commonIssues: [
          {
            issue: 'URL Blocked Error',
            solution: 'Ensure the exact redirect URI is added to Facebook app settings, including trailing slashes'
          },
          {
            issue: 'App Not Found',
            solution: 'Make sure your Facebook app is in development mode and you are logged in as an admin/developer'
          },
          {
            issue: 'Invalid App ID',
            solution: 'Verify FACEBOOK_APP_ID in your .env.local matches your Facebook app ID'
          }
        ],
        validationSteps: [
          'Check if FACEBOOK_APP_ID is set correctly',
          'Verify redirect URI matches exactly in Facebook settings',
          'Test with localhost first, then ngrok',
          'Check Facebook app is in development mode',
          'Ensure you are logged into Facebook as app admin'
        ]
      },
      testing: {
        directTestUrl: fbConfig.redirectUri.replace('/callback', ''),
        expectedCallback: fbConfig.redirectUri,
        environment: {
          development: environmentInfo.development,
          production: environmentInfo.production,
          ngrok: environmentInfo.ngrok,
          baseUrl: environmentInfo.baseUrl,
          redirectBaseUrl: environmentInfo.redirectBaseUrl
        }
      },
      nextSteps: [
        'Copy the exact redirect URIs to your Facebook app settings',
        'Test the OAuth flow using the social accounts dashboard',
        'If still getting errors, check the troubleshooting section',
        'Ensure your Facebook app is in development mode for testing'
      ]
    });
  } catch (error) {
    console.error('Facebook configuration helper error:', error);
    return NextResponse.json({
      error: 'Failed to generate Facebook configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
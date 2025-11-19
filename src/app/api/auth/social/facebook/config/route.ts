import { NextRequest, NextResponse } from 'next/server';

// Facebook OAuth Configuration Helper
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  
  try {
    switch (action) {
      case 'config':
        return getFacebookConfig();
      case 'validate':
        return validateFacebookConfig();
      case 'test':
        return testFacebookConnection();
      default:
        return NextResponse.json({
          error: 'Invalid action. Use: config, validate, or test'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Facebook config helper error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getFacebookConfig() {
  const config = {
    appId: process.env.FACEBOOK_APP_ID,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI,
    webhookUrl: process.env.FACEBOOK_WEBHOOK_CALLBACK_URL,
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN,
    nextauthUrl: process.env.NEXTAUTH_URL,
    nextauthProductionUrl: process.env.NEXTAUTH_URL_PRODUCTION,
    ngrokUrl: process.env.NGROK_URL,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };

  return NextResponse.json({
    message: 'Facebook OAuth Configuration',
    config,
    instructions: {
      facebookDeveloperConsole: 'https://developers.facebook.com/apps/',
      requiredSettings: [
        'Add these OAuth Redirect URIs to your Facebook App:',
        config.redirectUri,
        'http://localhost:3000/api/auth/social/facebook/callback',
        'https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback'
      ],
      appDomains: [
        'localhost',
        'mui-unpretentious-coextensively.ngrok-free.dev'
      ],
      validOAuthRedirectUris: [
        config.redirectUri,
        'http://localhost:3000/api/auth/social/facebook/callback',
        'https://mui-unpretentious-coextensively.ngrok-free.dev/api/auth/social/facebook/callback'
      ]
    }
  });
}

async function validateFacebookConfig() {
  const requiredEnvVars = [
    'FACEBOOK_APP_ID',
    'FACEBOOK_APP_SECRET',
    'FACEBOOK_REDIRECT_URI',
    'FACEBOOK_VERIFY_TOKEN'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  const config = {
    appId: process.env.FACEBOOK_APP_ID,
    redirectUri: process.env.FACEBOOK_REDIRECT_URI,
    webhookUrl: process.env.FACEBOOK_WEBHOOK_CALLBACK_URL,
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN
  };

  // Validate redirect URI format
  const redirectUriValid = config.redirectUri?.includes('/api/auth/social/facebook/callback');
  const webhookUrlValid = config.webhookUrl?.includes('/api/facebook/webhook');

  const issues = [];
  if (missing.length > 0) {
    issues.push(`Missing environment variables: ${missing.join(', ')}`);
  }
  if (!redirectUriValid) {
    issues.push(`Invalid redirect URI format: ${config.redirectUri}`);
  }
  if (!webhookUrlValid) {
    issues.push(`Invalid webhook URL format: ${config.webhookUrl}`);
  }

  return NextResponse.json({
    message: 'Facebook Configuration Validation',
    valid: issues.length === 0,
    issues,
    config,
    recommendations: [
      'Ensure all required environment variables are set',
      'Verify redirect URI matches Facebook app settings',
      'Check webhook URL is accessible from internet',
      'Test OAuth flow with provided URLs'
    ]
  });
}

async function testFacebookConnection() {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!appId || !redirectUri) {
    return NextResponse.json({
      error: 'Cannot test connection - missing Facebook App ID or Redirect URI'
    }, { status: 400 });
  }

  // Test OAuth URL construction
  const testAuthUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
  testAuthUrl.searchParams.set('client_id', appId);
  testAuthUrl.searchParams.set('redirect_uri', redirectUri);
  testAuthUrl.searchParams.set('scope', 'pages_manage_posts,pages_read_engagement,pages_messaging,pages_messaging_subscriptions,pages_manage_metadata');
  testAuthUrl.searchParams.set('response_type', 'code');
  testAuthUrl.searchParams.set('state', 'test_state');

  return NextResponse.json({
    message: 'Facebook Connection Test',
    testAuthUrl: testAuthUrl.toString(),
    expectedRedirectUri: redirectUri,
    appId: appId,
    status: 'ready_for_oauth',
    instructions: [
      'Copy the testAuthUrl and paste in browser',
      'If Facebook shows login/authorization page, configuration is correct',
      'If you get "URL blocked" error, update Facebook app settings',
      'Add the redirect URI to Facebook App → Settings → Advanced → OAuth Settings'
    ]
  });
}
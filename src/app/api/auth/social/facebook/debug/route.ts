import { NextRequest, NextResponse } from 'next/server';
import dynamicOAuthConfig from '@/lib/social-media/oauth-config';

// Facebook OAuth Debugger - Comprehensive diagnostic tool
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'diagnostic';
  
  try {
    switch (action) {
      case 'diagnostic':
        return runDiagnostic();
      case 'test-oauth':
        return testOAuthFlow();
      case 'validate-redirect':
        return validateRedirectUri();
      case 'generate-url':
        return generateOAuthUrl();
      case 'check-app-status':
        return checkAppStatus();
      default:
        return NextResponse.json({
          error: 'Invalid action. Available: diagnostic, test-oauth, validate-redirect, generate-url, check-app-status'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Facebook OAuth debugger error:', error);
    return NextResponse.json({
      error: 'Debugger error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function runDiagnostic() {
  const fbConfig = dynamicOAuthConfig.getConfigForProvider('facebook');
  const environmentInfo = dynamicOAuthConfig.getEnvironmentInfo();
  
  if (!fbConfig) {
    return NextResponse.json({
      error: 'Facebook configuration not available',
      message: 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set'
    }, { status: 400 });
  }

  // Comprehensive diagnostic
  const diagnostic = {
    timestamp: new Date().toISOString(),
    environment: environmentInfo,
    facebookConfig: {
      appId: fbConfig.clientId,
      redirectUri: fbConfig.redirectUri,
      scope: fbConfig.scope,
      authUrl: fbConfig.authUrl
    },
    validations: {
      hasAppId: !!fbConfig.clientId,
      hasAppSecret: !!fbConfig.clientSecret,
      redirectUriFormat: fbConfig.redirectUri.includes('/api/auth/social/facebook/callback'),
      redirectUriHttps: fbConfig.redirectUri.startsWith('https://'),
      redirectUriLocalhost: fbConfig.redirectUri.includes('localhost'),
      redirectUriNgrok: fbConfig.redirectUri.includes('ngrok-free.dev')
    },
    potentialIssues: [] as string[],
    recommendations: [] as string[],
    facebookAppSettings: {
      requiredAppDomains: [] as string[],
      requiredRedirectUris: [] as string[],
      settingsChecks: [] as string[]
    }
  };

  // Identify potential issues
  if (!diagnostic.validations.redirectUriFormat) {
    diagnostic.potentialIssues.push('Redirect URI format is incorrect');
  }

  if (!diagnostic.validations.redirectUriHttps && !diagnostic.validations.redirectUriLocalhost) {
    diagnostic.potentialIssues.push('Non-HTTPS redirect URI for non-localhost environment');
  }

  if (!fbConfig.clientId) {
    diagnostic.potentialIssues.push('FACEBOOK_APP_ID is missing');
  }

  if (!fbConfig.clientSecret) {
    diagnostic.potentialIssues.push('FACEBOOK_APP_SECRET is missing');
  }

  // Generate Facebook app settings
  const appDomains = new Set<string>();
  const redirectUris = new Set<string>();

  // Add localhost variants
  appDomains.add('localhost');
  redirectUris.add('http://localhost:3000/api/auth/social/facebook/callback');
  redirectUris.add('http://localhost:3001/api/auth/social/facebook/callback');

  // Add ngrok variants if available
  if (environmentInfo.ngrok && environmentInfo.baseUrl.includes('ngrok')) {
    const ngrokDomain = environmentInfo.baseUrl.replace('https://', '').split('/')[0];
    appDomains.add(ngrokDomain);
    redirectUris.add(`${environmentInfo.baseUrl}/api/auth/social/facebook/callback`);
  }

  // Add production variants
  if (environmentInfo.production && environmentInfo.baseUrl !== 'http://localhost:3000') {
    const productionDomain = environmentInfo.baseUrl.replace('https://', '').split('/')[0];
    appDomains.add(productionDomain);
    redirectUris.add(`${environmentInfo.baseUrl}/api/auth/social/facebook/callback`);
  }

  diagnostic.facebookAppSettings.requiredAppDomains = Array.from(appDomains);
  diagnostic.facebookAppSettings.requiredRedirectUris = Array.from(redirectUris);

  diagnostic.facebookAppSettings.settingsChecks = [
    'Go to Facebook Developers → Your App → Settings → Basic',
    'Add these App Domains: ' + Array.from(appDomains).join(', '),
    'Go to Facebook Login → Settings',
    'Add these OAuth Redirect URIs:',
    ...Array.from(redirectUris).map(uri => `  - ${uri}`),
    'Enable Client OAuth Login: Yes',
    'Enable Web OAuth Login: Yes',
    'Set Enforce HTTPS: No (for local development)',
    'Set Use Strict Mode for Redirect URIs: No'
  ];

  // Generate recommendations
  if (diagnostic.potentialIssues.length === 0) {
    diagnostic.recommendations.push('Configuration looks good! Check Facebook app settings.');
  } else {
    diagnostic.recommendations.push('Fix the identified issues above.');
    diagnostic.recommendations.push('Ensure all redirect URIs are added to Facebook app settings.');
    diagnostic.recommendations.push('Verify app is in Development mode for testing.');
  }

  diagnostic.recommendations.push('Test with the generated OAuth URL below.');

  return NextResponse.json({
    message: 'Facebook OAuth Diagnostic Report',
    diagnostic,
    nextSteps: [
      'Copy the exact redirect URIs to Facebook app settings',
      'Test OAuth flow with generated URL',
      'Check Facebook app is in Development mode',
      'Ensure you are logged in as app admin/developer'
    ]
  });
}

async function testOAuthFlow() {
  const fbConfig = dynamicOAuthConfig.getConfigForProvider('facebook');
  
  if (!fbConfig) {
    return NextResponse.json({ error: 'Facebook config not available' }, { status: 400 });
  }

  // Generate a test OAuth URL
  const testState = Buffer.from(JSON.stringify({
    test: true,
    timestamp: Date.now(),
    userId: 'test-user'
  })).toString('base64');

  const authUrl = new URL(fbConfig.authUrl);
  authUrl.searchParams.set('client_id', fbConfig.clientId);
  authUrl.searchParams.set('redirect_uri', fbConfig.redirectUri);
  authUrl.searchParams.set('scope', fbConfig.scope);
  authUrl.searchParams.set('state', testState);
  authUrl.searchParams.set('response_type', 'code');

  return NextResponse.json({
    message: 'Facebook OAuth Test Configuration',
    testAuthUrl: authUrl.toString(),
    expectedCallback: fbConfig.redirectUri,
    appId: fbConfig.clientId,
    scope: fbConfig.scope,
    instructions: [
      'Copy the testAuthUrl and paste in browser',
      'If Facebook shows login page, configuration is working',
      'If you get "URL blocked", check Facebook app settings',
      'Ensure redirect URI matches exactly in app settings'
    ],
    warning: 'This is a test URL. Do not use for production authentication.'
  });
}

async function validateRedirectUri() {
  const fbConfig = dynamicOAuthConfig.getConfigForProvider('facebook');
  
  if (!fbConfig) {
    return NextResponse.json({ error: 'Facebook config not available' }, { status: 400 });
  }

  const redirectUri = fbConfig.redirectUri;
  
  // Comprehensive validation
  const validation = {
    originalUri: redirectUri,
    formatCheck: {
      hasCorrectPath: redirectUri.includes('/api/auth/social/facebook/callback'),
      isHttps: redirectUri.startsWith('https://'),
      isLocalhost: redirectUri.includes('localhost'),
      hasTrailingSlash: redirectUri.endsWith('/'),
      containsSpaces: redirectUri.includes(' ')
    },
    facebookRequirements: {
      maxLength: redirectUri.length <= 2000,
      validProtocol: redirectUri.startsWith('https://') || redirectUri.includes('localhost'),
      noFragment: !redirectUri.includes('#'),
      validCharacters: /^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/.test(redirectUri)
    },
    issues: [] as string[],
    recommendations: [] as string[]
  };

  // Check for issues
  if (!validation.formatCheck.hasCorrectPath) {
    validation.issues.push('Redirect URI path is incorrect');
  }

  if (!validation.formatCheck.isHttps && !validation.formatCheck.isLocalhost) {
    validation.issues.push('Non-HTTPS redirect URI for non-localhost environment');
  }

  if (validation.formatCheck.containsSpaces) {
    validation.issues.push('Redirect URI contains spaces');
  }

  if (!validation.facebookRequirements.validCharacters) {
    validation.issues.push('Redirect URI contains invalid characters');
  }

  if (validation.issues.length === 0) {
    validation.recommendations.push('Redirect URI format is valid');
  } else {
    validation.recommendations.push('Fix the identified issues');
  }

  validation.recommendations.push('Ensure this exact URI is added to Facebook app settings');
  validation.recommendations.push('Check for any URL encoding issues');

  return NextResponse.json({
    message: 'Redirect URI Validation Report',
    validation,
    facebookSettings: {
      exactUriToAdd: redirectUri,
      alternativeUris: [
        redirectUri.replace('/callback', ''),
        redirectUri.replace('https://', 'http://').replace('localhost:3001', 'localhost:3000')
      ]
    }
  });
}

async function generateOAuthUrl() {
  const fbConfig = dynamicOAuthConfig.getConfigForProvider('facebook');
  
  if (!fbConfig) {
    return NextResponse.json({ error: 'Facebook config not available' }, { status: 400 });
  }

  // Generate current OAuth URL
  const state = Buffer.from(JSON.stringify({
    generated: true,
    timestamp: Date.now()
  })).toString('base64');

  const authUrl = new URL(fbConfig.authUrl);
  authUrl.searchParams.set('client_id', fbConfig.clientId);
  authUrl.searchParams.set('redirect_uri', fbConfig.redirectUri);
  authUrl.searchParams.set('scope', fbConfig.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');

  return NextResponse.json({
    message: 'Current OAuth URL Generation',
    authUrl: authUrl.toString(),
    parameters: {
      client_id: fbConfig.clientId,
      redirect_uri: fbConfig.redirectUri,
      scope: fbConfig.scope,
      state: state,
      response_type: 'code'
    },
    facebookAppSettings: {
      appDomains: [
        'localhost',
        'mui-unpretentious-coextensively.ngrok-free.dev'
      ],
      redirectUris: [
        fbConfig.redirectUri,
        'http://localhost:3000/api/auth/social/facebook/callback',
        'http://localhost:3001/api/auth/social/facebook/callback'
      ]
    }
  });
}

async function checkAppStatus() {
  const fbConfig = dynamicOAuthConfig.getConfigForProvider('facebook');
  
  if (!fbConfig) {
    return NextResponse.json({ error: 'Facebook config not available' }, { status: 400 });
  }

  // Check what we can about the app status
  const appStatus = {
    appId: fbConfig.clientId,
    hasAppSecret: !!fbConfig.clientSecret,
    redirectUri: fbConfig.redirectUri,
    checks: {
      appIdFormat: /^\d+$/.test(fbConfig.clientId),
      appIdLength: fbConfig.clientId.length >= 10 && fbConfig.clientId.length <= 20,
      hasValidRedirectUri: fbConfig.redirectUri.includes('/api/auth/social/facebook/callback'),
      environmentReady: true
    },
    recommendations: [] as string[]
  };

  if (!appStatus.checks.appIdFormat) {
    appStatus.recommendations.push('App ID should be numeric only');
  }

  if (!appStatus.checks.appIdLength) {
    appStatus.recommendations.push('App ID seems to be unusual length');
  }

  if (!appStatus.checks.hasValidRedirectUri) {
    appStatus.recommendations.push('Redirect URI format needs to be corrected');
  }

  appStatus.recommendations.push('Verify app is in Development mode for testing');
  appStatus.recommendations.push('Check that you are logged into Facebook as app admin');
  appStatus.recommendations.push('Ensure redirect URI is added to Facebook app settings');

  return NextResponse.json({
    message: 'Facebook App Status Check',
    appStatus,
    nextSteps: [
      'Go to Facebook Developers: https://developers.facebook.com/apps/',
      'Select your app and check settings',
      'Verify redirect URIs are correctly configured',
      'Test OAuth flow with generated URL'
    ]
  });
}
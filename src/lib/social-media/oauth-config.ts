// Dynamic OAuth Configuration System
// This module provides centralized OAuth configuration that adapts to different environments

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  platform: string;
}

export interface OAuthEnvironment {
  development: boolean;
  production: boolean;
  ngrok: boolean;
  baseUrl: string;
  redirectBaseUrl: string;
}

class DynamicOAuthConfig {
  private environment: OAuthEnvironment;
  
  constructor() {
    this.environment = this.detectEnvironment();
  }

  private detectEnvironment(): OAuthEnvironment {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';
    const hasNgrok = !!process.env.NGROK_URL;
    const hasProductionUrl = !!process.env.NEXTAUTH_URL_PRODUCTION;
    
    // Determine base URL for redirects
    let baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    let redirectBaseUrl = baseUrl;
    
    // In development with ngrok, use production URL if available
    if (isDevelopment && hasProductionUrl) {
      redirectBaseUrl = process.env.NEXTAUTH_URL_PRODUCTION!;
    } else if (hasNgrok) {
      // Use ngrok URL if available - force HTTPS for Live mode compatibility
      redirectBaseUrl = process.env.NGROK_URL!.replace('http://', 'https://');
    }
    
    // Force HTTPS for production/live mode
    if (isProduction && redirectBaseUrl.startsWith('http://')) {
      redirectBaseUrl = redirectBaseUrl.replace('http://', 'https://');
    }
    
    return {
      development: isDevelopment,
      production: isProduction,
      ngrok: hasNgrok,
      baseUrl,
      redirectBaseUrl
    };
  }

  public getFacebookConfig(): OAuthConfig {
    const redirectUri = `${this.environment.redirectBaseUrl}/api/oauth/social/facebook/callback`;
    
    return {
      clientId: process.env.FACEBOOK_APP_ID || '',
      clientSecret: process.env.FACEBOOK_APP_SECRET || '',
      redirectUri,
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      scope: 'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,pages_show_list,pages_messaging,pages_messaging_subscriptions,pages_manage_metadata',
      platform: 'facebook'
    };
  }

  public getInstagramConfig(): OAuthConfig {
    const redirectUri = `${this.environment.redirectBaseUrl}/api/oauth/social/instagram/callback`;
    
    return {
      clientId: process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID || '',
      clientSecret: process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '',
      redirectUri,
      authUrl: 'https://api.instagram.com/oauth/authorize',
      tokenUrl: 'https://api.instagram.com/oauth/access_token',
      scope: 'user_profile,user_media',
      platform: 'instagram'
    };
  }

  public getTwitterConfig(): OAuthConfig {
    const redirectUri = `${this.environment.redirectBaseUrl}/api/oauth/social/twitter/callback`;
    
    return {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      redirectUri,
      authUrl: 'https://twitter.com/oauth/authorize',
      tokenUrl: 'https://api.twitter.com/oauth/access_token',
      scope: 'tweet.read tweet.write users.read offline.access',
      platform: 'twitter'
    };
  }

  public getLinkedInConfig(): OAuthConfig {
    const redirectUri = `${this.environment.redirectBaseUrl}/api/oauth/social/linkedin/callback`;
    
    return {
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      redirectUri,
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scope: 'r_liteprofile r_emailaddress w_member_social',
      platform: 'linkedin'
    };
  }

  public getConfigForProvider(provider: string): OAuthConfig | null {
    switch (provider.toLowerCase()) {
      case 'facebook':
        return this.getFacebookConfig();
      case 'instagram':
        return this.getInstagramConfig();
      case 'twitter':
        return this.getTwitterConfig();
      case 'linkedin':
        return this.getLinkedInConfig();
      default:
        return null;
    }
  }

  public getEnvironmentInfo() {
    return {
      ...this.environment,
      allRedirectUris: this.getAllRedirectUris(),
      timestamp: new Date().toISOString()
    };
  }

  private getAllRedirectUris() {
    return {
      facebook: this.getFacebookConfig().redirectUri,
      instagram: this.getInstagramConfig().redirectUri,
      twitter: this.getTwitterConfig().redirectUri,
      linkedin: this.getLinkedInConfig().redirectUri
    };
  }

  public generateFacebookAppSettings() {
    const configs = this.getAllRedirectUris();
    const isLiveMode = this.environment.production;
    
    // For Live mode, only use HTTPS URLs and no localhost
    const appDomains = isLiveMode 
      ? ['mui-unpretentious-coextensively.ngrok-free.dev']
      : ['localhost', 'mui-unpretentious-coextensively.ngrok-free.dev'];
    
    const oauthRedirectUris = isLiveMode
      ? [
          `${this.environment.redirectBaseUrl}/api/oauth/social/facebook/callback`,
          `${this.environment.redirectBaseUrl}/api/oauth/social/instagram/callback`
        ]
      : [
          `${this.environment.redirectBaseUrl}/api/oauth/social/facebook/callback`,
          `${this.environment.redirectBaseUrl}/api/oauth/social/instagram/callback`,
          'http://localhost:3000/api/oauth/social/facebook/callback',
          'http://localhost:3001/api/oauth/social/facebook/callback',
          'http://localhost:3002/api/oauth/social/facebook/callback'
        ];
    
    return {
      appDomains,
      oauthRedirectUris,
      webhooks: {
        facebook: process.env.FACEBOOK_WEBHOOK_CALLBACK_URL,
        instagram: process.env.INSTAGRAM_WEBHOOK_CALLBACK_URL
      },
      settingsUrl: 'https://developers.facebook.com/apps/',
      mode: isLiveMode ? 'Live' : 'Development',
      instructions: [
        `Mode: ${isLiveMode ? 'LIVE' : 'DEVELOPMENT'}`,
        'Go to Facebook Developers → Your App → Settings → Basic',
        `Add app domains: ${appDomains.join(', ')}`,
        'Go to Facebook Login → Settings',
        'Add all OAuth redirect URIs listed above',
        'Enable Client OAuth Login and Web OAuth Login',
        isLiveMode ? 'Enforce HTTPS: Yes (Live mode requirement)' : 'Enforce HTTPS: No (for development)',
        isLiveMode ? 'Use Strict Mode: Yes (Live mode requirement)' : 'Use Strict Mode: No (for development)'
      ]
    };
  }
}

// Create singleton instance
const dynamicOAuthConfig = new DynamicOAuthConfig();

export default dynamicOAuthConfig;

// Export utility functions
export const getOAuthConfig = (provider: string) => dynamicOAuthConfig.getConfigForProvider(provider);
export const getEnvironmentInfo = () => dynamicOAuthConfig.getEnvironmentInfo();
export const getFacebookAppSettings = () => dynamicOAuthConfig.generateFacebookAppSettings();
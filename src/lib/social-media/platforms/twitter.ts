import { SocialMediaPlatform, PostContent, PostResult } from '../types';

export class TwitterPlatform implements SocialMediaPlatform {
  name = 'Twitter';
  clientId = process.env.TWITTER_CLIENT_ID;
  clientSecret = process.env.TWITTER_CLIENT_SECRET;

  async post(content: PostContent, accessToken: string): Promise<PostResult> {
    try {
      // Twitter API v2 implementation
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content.text,
          // For media support, would need to upload media first
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Twitter API error: ${error.detail || error.title}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        postId: result.data.id,
        url: `https://twitter.com/i/web/status/${result.data.id}`,
        platform: 'TWITTER',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Twitter posting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'TWITTER',
        timestamp: new Date(),
      };
    }
  }

  async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Twitter connection test error:', error);
      return false;
    }
  }

  async uploadMedia(file: Buffer, accessToken: string): Promise<string> {
    try {
      // Step 1: Upload media
      const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          media_data: file.toString('base64'),
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload media to Twitter');
      }

      const uploadResult = await uploadResponse.json();
      return uploadResult.media_id_string;
    } catch (error) {
      console.error('Twitter media upload error:', error);
      throw error;
    }
  }
}
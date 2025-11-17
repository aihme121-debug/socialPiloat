import { SocialMediaPlatform, PostContent, PostResult } from '../types';

export class LinkedInPlatform implements SocialMediaPlatform {
  name = 'LinkedIn';
  clientId = process.env.LINKEDIN_CLIENT_ID;
  clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  async post(content: PostContent, accessToken: string): Promise<PostResult> {
    try {
      // Get user profile
      const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to get LinkedIn profile');
      }

      const profile = await profileResponse.json();
      const authorId = profile.id;

      // Create post
      const postData = {
        author: `urn:li:person:${authorId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content.text,
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      };

      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`LinkedIn API error: ${error.message}`);
      }

      const result = await response.json();
      const postId = result.id;
      
      return {
        success: true,
        postId,
        url: `https://www.linkedin.com/feed/update/${postId}`,
        platform: 'LINKEDIN',
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('LinkedIn posting error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'LINKEDIN',
        timestamp: new Date(),
      };
    }
  }

  async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('LinkedIn connection test error:', error);
      return false;
    }
  }

  async uploadMedia(file: Buffer, accessToken: string): Promise<string> {
    try {
      // Step 1: Register upload
      const registerResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
            owner: 'urn:li:person:me',
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent',
              },
            ],
          },
        }),
      });

      if (!registerResponse.ok) {
        throw new Error('Failed to register LinkedIn media upload');
      }

      const uploadData = await registerResponse.json();
      const uploadUrl = uploadData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const assetId = uploadData.value.asset;

      // Step 2: Upload media
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: new Blob([new Uint8Array(file)]),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload media to LinkedIn');
      }

      return assetId;
    } catch (error) {
      console.error('LinkedIn media upload error:', error);
      throw error;
    }
  }
}
export class FacebookGraphAPI {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async getUserPages() {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${this.accessToken}&fields=id,name,access_token,category`)
    const data = await response.json()
    return data.data
  }

  async getInstagramBusinessAccount(pageId: string) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}?access_token=${this.accessToken}&fields=instagram_business_account{id,username,name}`)
    const data = await response.json()
    return data.instagram_business_account
  }

  async postToPage(pageId: string, message: string) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        access_token: this.accessToken
      })
    })
    const data = await response.json()
    return data.id
  }

  async uploadPhoto(pageId: string, imageUrl: string) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        access_token: this.accessToken
      })
    })
    const data = await response.json()
    return data.id
  }

  async postToPageWithMedia(pageId: string, message: string, mediaId: string) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        attached_media: [{ media_fbid: mediaId }],
        access_token: this.accessToken
      })
    })
    const data = await response.json()
    return data.id
  }

  async uploadInstagramPhoto(instagramAccountId: string, imageUrl: string, caption: string = '') {
    // Step 1: Create media container
    const createResponse = await fetch(`https://graph.facebook.com/v18.0/${instagramAccountId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: this.accessToken
      })
    })
    const createData = await createResponse.json()
    
    if (!createData.id) {
      throw new Error('Failed to create Instagram media container')
    }
    
    return createData.id
  }

  async publishInstagramMedia(creationId: string) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${creationId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: this.accessToken
      })
    })
    const data = await response.json()
    return data.id
  }

  async getPageInsights(pageId: string, since: string, until: string) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/insights?access_token=${this.accessToken}&since=${since}&until=${until}&metric=page_impressions,page_reach,page_engaged_users`)
    const data = await response.json()
    return data.data
  }

  async getPostInsights(postId: string) {
    const response = await fetch(`https://graph.facebook.com/v18.0/${postId}/insights?access_token=${this.accessToken}&metric=post_impressions,post_engaged_users`)
    const data = await response.json()
    return data.data
  }
}

export async function refreshFacebookToken(refreshToken: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Facebook doesn't support traditional refresh tokens
    // Long-lived tokens last ~60 days and can be extended
    const data = await response.json();
    
    if (data.access_token) {
      return {
        success: true,
        accessToken: data.access_token,
        expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined
      };
    }
    
    return { success: false, error: 'No access token in response' };
  } catch (error) {
    console.error('Facebook token refresh error:', error);
    return { success: false, error: 'Token refresh failed' };
  }
}

export default FacebookGraphAPI
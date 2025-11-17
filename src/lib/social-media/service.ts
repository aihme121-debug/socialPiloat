import { SocialPlatform } from '@prisma/client'
import FacebookGraphAPI from './facebook'
import { TwitterPlatform } from './platforms/twitter'
import { LinkedInPlatform } from './platforms/linkedin'

export interface PostContent {
  text: string
  mediaUrls?: string[]
  platforms: SocialPlatform[]
}

export interface SocialAccount {
  id: string
  platform: SocialPlatform
  accessToken: string
  accountId: string
  accountName: string
  settings: any
}

export class SocialMediaService {
  
  static async postContent(content: PostContent, accounts: SocialAccount[]) {
    const results = []
    
    for (const account of accounts) {
      if (content.platforms.includes(account.platform)) {
        try {
          const result = await this.postToPlatform(content, account)
          results.push({
            accountId: account.id,
            platform: account.platform,
            success: true,
            postId: result.postId,
            url: result.url
          })
        } catch (error) {
          console.error(`Error posting to ${account.platform}:`, error)
          results.push({
            accountId: account.id,
            platform: account.platform,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }
    
    return results
  }
  
  static async postToPlatform(content: PostContent, account: SocialAccount) {
    switch (account.platform) {
      case 'FACEBOOK':
        return await this.postToFacebook(content, account)
      case 'INSTAGRAM':
        return await this.postToInstagram(content, account)
      case 'TWITTER':
        return await this.postToTwitter(content, account)
      case 'LINKEDIN':
        return await this.postToLinkedIn(content, account)
      default:
        throw new Error(`Platform ${account.platform} not implemented`)
    }
  }
  
  static async postToFacebook(content: PostContent, account: SocialAccount) {
    const facebook = new FacebookGraphAPI(account.accessToken)
    
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      // Post with media
      const mediaId = await facebook.uploadPhoto(account.accountId, content.mediaUrls[0])
      const postId = await facebook.postToPageWithMedia(account.accountId, content.text, mediaId)
      return {
        postId,
        url: `https://facebook.com/${postId}`
      }
    } else {
      // Text-only post
      const postId = await facebook.postToPage(account.accountId, content.text)
      return {
        postId,
        url: `https://facebook.com/${postId}`
      }
    }
  }
  
  static async postToInstagram(content: PostContent, account: SocialAccount) {
    const facebook = new FacebookGraphAPI(account.accessToken)
    
    // Get Instagram Business Account
    const instagramAccount = await facebook.getInstagramBusinessAccount(account.accountId)
    if (!instagramAccount) {
      throw new Error('No Instagram Business account connected to this Facebook page')
    }
    
    if (content.mediaUrls && content.mediaUrls.length > 0) {
      // Post photo to Instagram
      const mediaId = await facebook.uploadInstagramPhoto(instagramAccount.id, content.mediaUrls[0], content.text)
      await facebook.publishInstagramMedia(mediaId)
      return {
        postId: mediaId,
        url: `https://instagram.com/p/${mediaId}`
      }
    } else {
      throw new Error('Instagram requires at least one media file')
    }
  }
  
  static async postToTwitter(content: PostContent, account: SocialAccount) {
    const twitter = new TwitterPlatform()
    const result = await twitter.post(content, account.accessToken)
    
    if (!result.success) {
      throw new Error(result.error)
    }
    
    return {
      postId: result.postId!,
      url: result.url!
    }
  }
  
  static async postToLinkedIn(content: PostContent, account: SocialAccount) {
    const linkedin = new LinkedInPlatform()
    const result = await linkedin.post(content, account.accessToken)
    
    if (!result.success) {
      throw new Error(result.error)
    }
    
    return {
      postId: result.postId!,
      url: result.url!
    }
  }
  
  static async testConnection(account: SocialAccount): Promise<boolean> {
    try {
      switch (account.platform) {
        case 'FACEBOOK':
          const facebook = new FacebookGraphAPI(account.accessToken)
          const pages = await facebook.getUserPages()
          return pages.length > 0
        case 'INSTAGRAM':
          // Test Instagram connection through Facebook
          const fb = new FacebookGraphAPI(account.accessToken)
          const instagramAccount = await fb.getInstagramBusinessAccount(account.accountId)
          return !!instagramAccount
        default:
          return false
      }
    } catch (error) {
      console.error(`Connection test failed for ${account.platform}:`, error)
      return false
    }
  }
}

export default SocialMediaService
export interface PostContent {
  text: string;
  mediaUrls?: string[];
  platforms: string[];
}

export interface PostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  platform: string;
  timestamp: Date;
}

export interface SocialMediaPlatform {
  name: string;
  clientId?: string;
  clientSecret?: string;
  
  post(content: PostContent, accessToken: string): Promise<PostResult>;
  testConnection(accessToken: string): Promise<boolean>;
  uploadMedia?(file: Buffer, accessToken: string): Promise<string>;
}
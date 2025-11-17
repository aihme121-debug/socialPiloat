export interface AIProvider {
  id: string;
  name: string;
  type: 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'LOCAL';
  apiKey?: string;
  endpoint?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIUsage {
  id: string;
  businessId: string;
  userId: string;
  providerId: string;
  model: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  currency: string;
  operation: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface AIContent {
  id: string;
  businessId: string;
  userId: string;
  type: 'POST' | 'REPLY' | 'TEMPLATE' | 'DESCRIPTION' | 'CAPTION' | 'HASHTAGS' | 'SUMMARY';
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'LINKEDIN' | 'TWITTER' | 'GENERIC';
  prompt: string;
  content: string;
  metadata?: Record<string, any>;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  usage?: AIUsage;
  createdAt: Date;
  updatedAt: Date;
}

export interface AITemplate {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  type: 'POST' | 'REPLY' | 'DESCRIPTION' | 'CAPTION' | 'HASHTAGS';
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'LINKEDIN' | 'TWITTER' | 'GENERIC';
  prompt: string;
  variables: string[];
  examples: string[];
  tags: string[];
  isActive: boolean;
  usageCount: number;
  averageRating?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIKnowledgeBase {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  type: 'DOCUMENT' | 'WEBSITE' | 'FAQ' | 'PRODUCT' | 'POLICY' | 'CUSTOM';
  content: string;
  metadata?: Record<string, any>;
  chunks: AIKnowledgeChunk[];
  isActive: boolean;
  lastIndexedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIKnowledgeChunk {
  id: string;
  knowledgeBaseId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  score?: number;
  createdAt: Date;
}

export interface AIRAGQuery {
  id: string;
  businessId: string;
  userId: string;
  query: string;
  context: AIKnowledgeChunk[];
  response: string;
  metadata?: Record<string, any>;
  usage?: AIUsage;
  createdAt: Date;
}

export interface AISettings {
  businessId: string;
  defaultProviderId?: string;
  defaultModel?: string;
  maxTokensPerRequest: number;
  temperature: number;
  enableRAG: boolean;
  enableContentModeration: boolean;
  enableUsageTracking: boolean;
  enableCostLimit: boolean;
  monthlyCostLimit?: number;
  blockedKeywords: string[];
  allowedPlatforms: string[];
  customInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateContentRequest {
  businessId: string;
  type: AIContent['type'];
  platform: AIContent['platform'];
  prompt: string;
  templateId?: string;
  variables?: Record<string, any>;
  context?: string;
  tone?: 'PROFESSIONAL' | 'CASUAL' | 'FRIENDLY' | 'FORMAL' | 'HUMOROUS' | 'PERSUASIVE';
  length?: 'SHORT' | 'MEDIUM' | 'LONG';
  includeHashtags?: boolean;
  includeEmojis?: boolean;
  language?: string;
  targetAudience?: string;
}

export interface GenerateReplyRequest {
  conversationId: string;
  messageContext: string;
  customerTone?: 'ANGRY' | 'HAPPY' | 'CONFUSED' | 'URGENT' | 'NEUTRAL';
  responseTone?: 'EMPATHETIC' | 'APOLOGETIC' | 'INFORMATIVE' | 'GRATEFUL' | 'PROFESSIONAL';
  includeKnowledgeBase?: boolean;
  previousMessages?: string[];
}

export interface AIGenerationResponse {
  content: string;
  usage: {
    tokens: number;
    cost: number;
    model: string;
  };
  metadata?: Record<string, any>;
  alternatives?: string[];
}

export interface AIAnalytics {
  totalUsage: number;
  totalCost: number;
  usageByType: Record<string, number>;
  usageByPlatform: Record<string, number>;
  usageByModel: Record<string, number>;
  topTemplates: Array<{
    templateId: string;
    name: string;
    usage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    usage: number;
    cost: number;
  }>;
  averageRating?: number;
  mostUsedProvider?: string;
  mostUsedModel?: string;
}
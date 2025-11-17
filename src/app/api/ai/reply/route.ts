import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { AIService } from '@/lib/ai/ai-service';
import { GenerateReplyRequest } from '@/types/ai';

// POST /api/ai/reply - Generate AI reply for chat messages
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body: GenerateReplyRequest = await request.json();
    const { conversationId, messageContext, customerTone, responseTone, includeKnowledgeBase, previousMessages } = body;

    if (!conversationId || !messageContext) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user has access to this conversation (using ChatMessage as proxy)
    const message = await db.chatMessage.findFirst({
      where: {
        id: conversationId,
        businessId: user.tenantId, // This might need adjustment based on actual schema
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
    }

    // Get AI provider (using a simple approach for now)
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    // Initialize AI service
    const aiService = new AIService(openaiApiKey);

    // Get knowledge base context if requested
    let knowledgeContext: any[] = [];
    if (includeKnowledgeBase) {
      // For now, we'll use a simple approach without knowledge base
      // In a real implementation, you'd fetch relevant content from your business data
      knowledgeContext = [];
    }

    // Generate reply
    const result = await aiService.generateReply(messageContext);

    // Create AI content record
    const aiContent = await db.content.create({
      data: {
        contentText: result.content,
        contentType: 'reply',
        mediaUrls: [],
        aiMetadata: {
          conversationId,
          customerTone,
          responseTone,
          includeKnowledgeBase,
          previousMessages,
          knowledgeContext,
          prompt: `Customer message: ${messageContext}`,
        },
        userId: user.id,
        businessId: user.tenantId,
        status: 'DRAFT',
      },
    });

    // Create AI usage record
    await db.aIUsage.create({
      data: {
        type: 'TEXT',
        inputTokens: Math.floor(result.tokens * 0.7),
        outputTokens: Math.floor(result.tokens * 0.3),
        cost: result.cost,
        userId: user.id,
        businessId: user.tenantId,
        modelId: 'default-model-id',
      },
    });

    return NextResponse.json({
      reply: result.content,
      contentId: aiContent.id,
      usage: {
        tokens: result.tokens,
        cost: result.cost,
        model: 'gpt-3.5-turbo',
      },
    });
  } catch (error) {
    console.error('Error generating AI reply:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/ai/reply - Get AI reply history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const conversationId = searchParams.get('conversationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    // Check if user has access to this business
    const businessAccess = await db.business.findFirst({
      where: {
        id: businessId,
        tenantId: user.tenantId,
      },
    });

    if (!businessAccess) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check if user belongs to this business
    const userBusiness = await db.user.findFirst({
      where: {
        id: user.id,
        businessId: businessId,
      },
    });

    if (!userBusiness) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const where: any = {
      businessId,
      type: 'REPLY',
    };

    if (conversationId) {
      where.metadata = {
        path: ['conversationId'],
        equals: conversationId,
      };
    }

    const [contents, total] = await Promise.all([
      db.content.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      db.content.count({ where }),
    ]);

    return NextResponse.json({
      replies: contents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching AI replies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
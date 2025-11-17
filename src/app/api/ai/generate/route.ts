import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { AIService } from '@/lib/ai/ai-service';
import { GenerateContentRequest } from '@/types/ai';

// POST /api/ai/generate - Generate AI content
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

    const body: GenerateContentRequest = await request.json();
    const { businessId, type, platform, prompt, templateId, variables, tone, length, includeHashtags, includeEmojis, language, targetAudience } = body;

    if (!businessId || !type || !platform || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // Use OpenAI directly for now
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    // Initialize AI service
    const aiService = new AIService(openaiApiKey);

    // Generate content
    const result = await aiService.generateContent(prompt);

    // Create AI usage record
    await db.aIUsage.create({
      data: {
        type: 'TEXT',
        inputTokens: result.tokens,
        outputTokens: Math.floor(result.tokens * 0.3),
        cost: result.cost,
        userId: user.id,
        businessId: businessId,
        modelId: 'default-model-id', // Will need to create a default model
      },
    });

    return NextResponse.json({
      content: result.content,
      usage: {
        tokens: result.tokens,
        cost: result.cost,
        model: 'gpt-3.5-turbo',
      },
    });
  } catch (error) {
    console.error('Error generating AI content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/ai/generate - Get AI content history
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

    const [contents, total] = await Promise.all([
      db.content.findMany({
        where: { businessId },
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
      db.content.count({ where: { businessId } }),
    ]);

    return NextResponse.json({
      contents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching AI content:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
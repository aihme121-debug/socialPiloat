import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AutomationService } from '@/lib/services/automation-service';
import { AutomationTriggerType, AutomationStatus } from '@prisma/client';

const automationService = new AutomationService();

/**
 * GET /api/automation/rules
 * Get all automation rules for the business
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as AutomationStatus | null;

    const rules = await automationService.getRules(session.user.businessId, status || undefined);
    
    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automation/rules
 * Create a new automation rule
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      triggerType,
      triggerConfig,
      conditions,
      actions,
      priority,
      campaignId,
    } = body;

    // Validate required fields
    if (!name || !triggerType || !triggerConfig || !actions) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate trigger type
    if (!Object.values(AutomationTriggerType).includes(triggerType)) {
      return NextResponse.json(
        { error: 'Invalid trigger type' },
        { status: 400 }
      );
    }

    const rule = await automationService.createRule(session.user.businessId, {
      name,
      description,
      triggerType,
      triggerConfig,
      conditions: conditions || {},
      actions,
      priority: priority || 0,
      campaignId,
      createdBy: session.user.id,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Error creating automation rule:', error);
    return NextResponse.json(
      { error: 'Failed to create automation rule' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AutomationService } from '@/lib/services/automation-service';
import { AutomationStatus } from '@prisma/client';

const automationService = new AutomationService();

/**
 * GET /api/automation/rules/[id]
 * Get a specific automation rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rule = await automationService.getRule(params.id, session.user.businessId);
    
    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error fetching automation rule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation rule' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/automation/rules/[id]
 * Update an automation rule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
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

    const rule = await automationService.updateRule(
      params.id,
      session.user.businessId,
      {
        name,
        description,
        triggerType,
        triggerConfig,
        conditions,
        actions,
        priority,
        campaignId,
      }
    );

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return NextResponse.json(
      { error: 'Failed to update automation rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automation/rules/[id]
 * Delete an automation rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await automationService.deleteRule(params.id, session.user.businessId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete automation rule' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automation/rules/[id]/status
 * Update automation rule status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    if (!Object.values(AutomationStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const rule = await automationService.updateRuleStatus(
      params.id,
      session.user.businessId,
      status
    );

    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error updating automation rule status:', error);
    return NextResponse.json(
      { error: 'Failed to update automation rule status' },
      { status: 500 }
    );
  }
}
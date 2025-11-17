import { prisma } from '@/lib/prisma';
import { AutomationRule, AutomationExecution, AutomationTriggerType, AutomationStatus, AutomationExecutionStatus } from '@prisma/client';

export interface AutomationRuleInput {
  name: string;
  description?: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, any>;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority?: number;
  campaignId?: string;
  createdBy: string;
}

export interface AutomationExecutionInput {
  ruleId: string;
  status: AutomationExecutionStatus;
  triggerData: Record<string, any>;
  executionResult?: Record<string, any>;
  errorMessage?: string;
  executionDurationMs?: number;
}

export class AutomationService {
  /**
   * Create a new automation rule
   */
  async createRule(businessId: string, input: AutomationRuleInput): Promise<AutomationRule> {
    return prisma.automationRule.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig,
        conditions: input.conditions,
        actions: input.actions,
        priority: input.priority || 0,
        campaignId: input.campaignId,
        createdBy: input.createdBy,
        status: AutomationStatus.ACTIVE,
      },
    });
  }

  /**
   * Get all automation rules for a business
   */
  async getRules(businessId: string, status?: AutomationStatus): Promise<AutomationRule[]> {
    const where: any = { businessId };
    if (status) {
      where.status = status;
    }

    return prisma.automationRule.findMany({
      where,
      orderBy: { priority: 'desc' },
      include: {
        executions: {
          take: 5,
          orderBy: { triggeredAt: 'desc' },
        },
        campaign: true,
      },
    });
  }

  /**
   * Get a specific automation rule
   */
  async getRule(id: string, businessId: string): Promise<AutomationRule | null> {
    return prisma.automationRule.findFirst({
      where: { id, businessId },
      include: {
        executions: {
          orderBy: { triggeredAt: 'desc' },
          take: 10,
        },
        campaign: true,
      },
    });
  }

  /**
   * Update an automation rule
   */
  async updateRule(
    id: string,
    businessId: string,
    input: Partial<AutomationRuleInput>
  ): Promise<AutomationRule> {
    return prisma.automationRule.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig,
        conditions: input.conditions,
        actions: input.actions,
        priority: input.priority,
        campaignId: input.campaignId,
      },
    });
  }

  /**
   * Delete an automation rule
   */
  async deleteRule(id: string, businessId: string): Promise<AutomationRule> {
    return prisma.automationRule.delete({
      where: { id },
    });
  }

  /**
   * Update rule status
   */
  async updateRuleStatus(
    id: string,
    businessId: string,
    status: AutomationStatus
  ): Promise<AutomationRule> {
    return prisma.automationRule.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Execute an automation rule
   */
  async executeRule(ruleId: string, triggerData: Record<string, any>): Promise<AutomationExecution> {
    const startTime = Date.now();
    
    try {
      const rule = await prisma.automationRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule) {
        throw new Error('Automation rule not found');
      }

      if (rule.status !== AutomationStatus.ACTIVE) {
        return this.createExecution({
          ruleId,
          status: AutomationExecutionStatus.SKIPPED,
          triggerData,
          executionResult: { reason: 'Rule is not active' },
        });
      }

      // Evaluate conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions as Record<string, any>, triggerData);
      
      if (!conditionsMet) {
        return this.createExecution({
          ruleId,
          status: AutomationExecutionStatus.SKIPPED,
          triggerData,
          executionResult: { reason: 'Conditions not met' },
        });
      }

      // Execute actions
      const executionResult = await this.executeActions(rule.actions as Record<string, any>, triggerData);
      const executionDuration = Date.now() - startTime;

      // Update rule statistics
      await prisma.automationRule.update({
        where: { id: ruleId },
        data: {
          lastExecutedAt: new Date(),
          executionCount: { increment: 1 },
          successCount: { increment: 1 },
        },
      });

      return this.createExecution({
        ruleId,
        status: AutomationExecutionStatus.SUCCESS,
        triggerData,
        executionResult,
        executionDurationMs: executionDuration,
      });

    } catch (error) {
      const executionDuration = Date.now() - startTime;
      
      // Update failure statistics
      await prisma.automationRule.update({
        where: { id: ruleId },
        data: {
          failureCount: { increment: 1 },
        },
      });

      return this.createExecution({
        ruleId,
        status: AutomationExecutionStatus.FAILED,
        triggerData,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionDurationMs: executionDuration,
      });
    }
  }

  /**
   * Get execution history for a business
   */
  async getExecutionHistory(businessId: string): Promise<any[]> {
    const executions = await prisma.automationExecution.findMany({
      where: {
        rule: {
          businessId,
        },
      },
      include: {
        rule: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        triggeredAt: 'desc',
      },
      take: 100,
    });

    return executions.map(execution => ({
      id: execution.id,
      ruleId: execution.ruleId,
      ruleName: execution.rule.name,
      status: execution.status,
      startedAt: execution.triggeredAt,
      completedAt: execution.completedAt,
      error: execution.errorMessage,
      executionTime: execution.executionDurationMs || 0,
    }));
  }

  /**
   * Create an automation execution record
   */
  private async createExecution(input: AutomationExecutionInput): Promise<AutomationExecution> {
    return prisma.automationExecution.create({
      data: {
        ruleId: input.ruleId,
        status: input.status,
        triggerData: input.triggerData,
        executionResult: input.executionResult,
        errorMessage: input.errorMessage,
        executionDurationMs: input.executionDurationMs,
        completedAt: input.status !== AutomationExecutionStatus.SUCCESS ? new Date() : undefined,
      },
    });
  }

  /**
   * Evaluate rule conditions
   */
  private async evaluateConditions(conditions: Record<string, any>, triggerData: Record<string, any>): Promise<boolean> {
    // Simple condition evaluation - can be extended with more complex logic
    const { type, rules } = conditions;
    
    if (!rules || !Array.isArray(rules)) {
      return true; // No conditions means always match
    }

    const results = rules.map((rule: any) => {
      const { field, operator, value } = rule;
      const actualValue = this.getNestedValue(triggerData, field);
      
      switch (operator) {
        case 'equals':
          return actualValue === value;
        case 'not_equals':
          return actualValue !== value;
        case 'greater_than':
          return Number(actualValue) > Number(value);
        case 'less_than':
          return Number(actualValue) < Number(value);
        case 'contains':
          return String(actualValue).includes(String(value));
        case 'not_contains':
          return !String(actualValue).includes(String(value));
        default:
          return true;
      }
    });

    return type === 'AND' ? results.every(Boolean) : results.some(Boolean);
  }

  /**
   * Execute rule actions
   */
  private async executeActions(actions: Record<string, any>, triggerData: Record<string, any>): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    
    for (const [actionType, actionConfig] of Object.entries(actions)) {
      try {
        switch (actionType) {
          case 'SEND_NOTIFICATION':
            results[actionType] = await this.sendNotification(actionConfig, triggerData);
            break;
          case 'CREATE_CONTENT':
            results[actionType] = await this.createContent(actionConfig, triggerData);
            break;
          case 'SCHEDULE_POST':
            results[actionType] = await this.schedulePost(actionConfig, triggerData);
            break;
          case 'UPDATE_STATUS':
            results[actionType] = await this.updateStatus(actionConfig, triggerData);
            break;
          case 'TRIGGER_WEBHOOK':
            results[actionType] = await this.triggerWebhook(actionConfig, triggerData);
            break;
          default:
            results[actionType] = { success: false, error: 'Unknown action type' };
        }
      } catch (error) {
        results[actionType] = { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }
    
    return results;
  }

  /**
   * Helper method to get nested object values
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Action implementations
   */
  private async sendNotification(config: any, triggerData: Record<string, any>): Promise<any> {
    // Implementation for sending notifications
    return { success: true, message: 'Notification sent' };
  }

  private async createContent(config: any, triggerData: Record<string, any>): Promise<any> {
    // Implementation for creating content
    return { success: true, contentId: 'generated-content-id' };
  }

  private async schedulePost(config: any, triggerData: Record<string, any>): Promise<any> {
    // Implementation for scheduling posts
    return { success: true, scheduledAt: config.scheduleTime };
  }

  private async updateStatus(config: any, triggerData: Record<string, any>): Promise<any> {
    // Implementation for updating status
    return { success: true, newStatus: config.status };
  }

  private async triggerWebhook(config: any, triggerData: Record<string, any>): Promise<any> {
    // Implementation for triggering webhooks
    return { success: true, webhookUrl: config.url };
  }

  /**
   * Get automation statistics
   */
  async getAutomationStats(businessId: string): Promise<{
    totalRules: number;
    activeRules: number;
    totalExecutions: number;
    successRate: number;
    recentExecutions: AutomationExecution[];
  }> {
    const [totalRules, activeRules, totalExecutions, recentExecutions] = await Promise.all([
      prisma.automationRule.count({ where: { businessId } }),
      prisma.automationRule.count({ where: { businessId, status: AutomationStatus.ACTIVE } }),
      prisma.automationExecution.count({
        where: {
          rule: { businessId },
        },
      }),
      prisma.automationExecution.findMany({
        where: {
          rule: { businessId },
        },
        include: {
          rule: {
            select: { name: true },
          },
        },
        orderBy: { triggeredAt: 'desc' },
        take: 10,
      }),
    ]);

    const successCount = await prisma.automationExecution.count({
      where: {
        rule: { businessId },
        status: AutomationExecutionStatus.SUCCESS,
      },
    });

    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

    return {
      totalRules,
      activeRules,
      totalExecutions,
      successRate: Math.round(successRate * 100) / 100,
      recentExecutions,
    };
  }
}
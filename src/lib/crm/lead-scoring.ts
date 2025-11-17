export interface LeadScoringRule {
  id: string;
  name: string;
  conditions: ScoringCondition[];
  score: number;
  isActive: boolean;
  priority: number;
}

export interface ScoringCondition {
  field: string;
  operator: string;
  value: any;
  weight: number;
}

export interface LeadScoringResult {
  leadId: string;
  score: number;
  breakdown: ScoringBreakdown[];
  grade: string;
  recommendations: string[];
}

export interface ScoringBreakdown {
  ruleId: string;
  ruleName: string;
  score: number;
  matched: boolean;
}

export class LeadScoringService {
  private rules: LeadScoringRule[] = [];

  constructor(rules: LeadScoringRule[] = []) {
    this.rules = rules.filter(rule => rule.isActive).sort((a, b) => b.priority - a.priority);
  }

  async calculateScore(lead: any, additionalData: Record<string, any> = {}): Promise<LeadScoringResult> {
    const breakdown: ScoringBreakdown[] = [];
    let totalScore = 0;

    // Combine lead data with additional context
    const context = {
      ...lead,
      ...additionalData,
      daysSinceCreation: Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      daysSinceLastActivity: lead.lastActivityAt ? 
        Math.floor((Date.now() - new Date(lead.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)) : null,
    };

    // Apply each scoring rule
    for (const rule of this.rules) {
      const ruleResult = this.evaluateRule(rule, context);
      breakdown.push(ruleResult);
      
      if (ruleResult.matched) {
        totalScore += ruleResult.score;
      }
    }

    const grade = this.getGradeFromScore(totalScore);
    const recommendations = this.generateRecommendations(lead, totalScore);

    return {
      leadId: lead.id,
      score: Math.round(totalScore),
      breakdown,
      grade,
      recommendations,
    };
  }

  private evaluateRule(rule: LeadScoringRule, context: Record<string, any>): ScoringBreakdown {
    let matched = true;

    for (const condition of rule.conditions) {
      const conditionMatched = this.evaluateCondition(condition, context);
      if (!conditionMatched) {
        matched = false;
        break;
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      score: matched ? rule.score : 0,
      matched,
    };
  }

  private evaluateCondition(condition: ScoringCondition, context: Record<string, any>): boolean {
    const fieldValue = this.getNestedValue(context, condition.field);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'EQUALS':
        return fieldValue === conditionValue;
      case 'NOT_EQUALS':
        return fieldValue !== conditionValue;
      case 'CONTAINS':
        return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'NOT_CONTAINS':
        return !String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
      case 'GREATER_THAN':
        return Number(fieldValue) > Number(conditionValue);
      case 'LESS_THAN':
        return Number(fieldValue) < Number(conditionValue);
      case 'IN':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'NOT_IN':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'IS_EMPTY':
        return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'IS_NOT_EMPTY':
        return fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getGradeFromScore(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  private generateRecommendations(lead: any, score: number): string[] {
    const recommendations: string[] = [];

    // Score-based recommendations
    if (score >= 80) {
      recommendations.push('High-priority lead - assign to senior sales rep immediately');
      recommendations.push('Schedule follow-up within 24 hours');
    } else if (score >= 60) {
      recommendations.push('Medium-priority lead - follow up within 3-5 days');
      recommendations.push('Consider nurturing campaign');
    } else {
      recommendations.push('Low-priority lead - add to long-term nurturing');
      recommendations.push('Focus on education and awareness content');
    }

    // Time-based recommendations
    const daysSinceCreation = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceCreation > 30 && score < 50) {
      recommendations.push('Stale lead - consider re-engagement campaign or archival');
    }

    return recommendations;
  }

  // Default scoring rules
  static getDefaultRules(): LeadScoringRule[] {
    return [
      {
        id: 'rule-high-value-company',
        name: 'High Value Company',
        conditions: [
          {
            field: 'customer.companySize',
            operator: 'GREATER_THAN',
            value: 100,
            weight: 1,
          },
        ],
        score: 25,
        isActive: true,
        priority: 10,
      },
      {
        id: 'rule-decision-maker',
        name: 'Decision Maker Title',
        conditions: [
          {
            field: 'customer.jobTitle',
            operator: 'CONTAINS',
            value: 'manager',
            weight: 1,
          },
        ],
        score: 20,
        isActive: true,
        priority: 9,
      },
      {
        id: 'rule-high-engagement',
        name: 'High Engagement',
        conditions: [
          {
            field: 'activityCount',
            operator: 'GREATER_THAN',
            value: 3,
            weight: 1,
          },
        ],
        score: 15,
        isActive: true,
        priority: 8,
      },
      {
        id: 'rule-recent-activity',
        name: 'Recent Activity',
        conditions: [
          {
            field: 'daysSinceLastActivity',
            operator: 'LESS_THAN',
            value: 7,
            weight: 1,
          },
        ],
        score: 10,
        isActive: true,
        priority: 7,
      },
      {
        id: 'rule-qualified-source',
        name: 'Qualified Source',
        conditions: [
          {
            field: 'source',
            operator: 'IN',
            value: ['REFERRAL', 'WEBSITE', 'EVENT'],
            weight: 1,
          },
        ],
        score: 15,
        isActive: true,
        priority: 6,
      },
      {
        id: 'rule-complete-profile',
        name: 'Complete Profile',
        conditions: [
          {
            field: 'customer.email',
            operator: 'IS_NOT_EMPTY',
            value: null,
            weight: 1,
          },
          {
            field: 'customer.phone',
            operator: 'IS_NOT_EMPTY',
            value: null,
            weight: 1,
          },
        ],
        score: 10,
        isActive: true,
        priority: 5,
      },
    ];
  }

  addRule(rule: LeadScoringRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  updateRules(rules: LeadScoringRule[]): void {
    this.rules = rules.filter(rule => rule.isActive).sort((a, b) => b.priority - a.priority);
  }

  getRules(): LeadScoringRule[] {
    return this.rules;
  }
}
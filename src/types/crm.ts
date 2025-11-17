export interface CRMLead {
  id: string;
  businessId: string;
  customerId: string;
  title: string;
  description?: string;
  status: CRMLeadStatus;
  priority: CRMPriority;
  source: CRMLeadSource;
  value: number;
  currency: string;
  assignedTo?: string;
  tags: string[];
  customFields: Record<string, any>;
  score: number;
  lastActivityAt: Date;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMCustomer {
  id: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  company?: string;
  jobTitle?: string;
  tags: string[];
  customFields: Record<string, any>;
  lifecycleStage: CRMLifecycleStage;
  leadScore: number;
  totalValue: number;
  lastContactAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMOpportunity {
  id: string;
  businessId: string;
  leadId: string;
  customerId: string;
  title: string;
  description?: string;
  stage: CRMSalesStage;
  probability: number;
  value: number;
  currency: string;
  expectedCloseDate?: Date;
  assignedTo?: string;
  products: CRMProduct[];
  activities: CRMActivity[];
  tags: string[];
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  wonAt?: Date;
  lostAt?: Date;
  lostReason?: CRMLostReason;
}

export interface CRMProduct {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
}

export interface CRMActivity {
  id: string;
  businessId: string;
  type: CRMActivityType;
  title: string;
  description?: string;
  dueDate?: Date;
  completedAt?: Date;
  status: CRMActivityStatus;
  priority: CRMPriority;
  assignedTo?: string;
  relatedTo: {
    type: CRMRelatedType;
    id: string;
  };
  participants: string[];
  outcome?: string;
  tags: string[];
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMLeadScoringRule {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  conditions: CRMScoringCondition[];
  score: number;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMScoringCondition {
  field: string;
  operator: CRMFilterOperator;
  value: any;
  weight: number;
}

// Enums
export enum CRMLeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST'
}

export enum CRMPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum CRMLeadSource {
  WEBSITE = 'WEBSITE',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  REFERRAL = 'REFERRAL',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  ADVERTISEMENT = 'ADVERTISEMENT',
  EVENT = 'EVENT',
  CHAT = 'CHAT',
  OTHER = 'OTHER'
}

export enum CRMLifecycleStage {
  SUBSCRIBER = 'SUBSCRIBER',
  LEAD = 'LEAD',
  MARKETING_QUALIFIED_LEAD = 'MARKETING_QUALIFIED_LEAD',
  SALES_QUALIFIED_LEAD = 'SALES_QUALIFIED_LEAD',
  OPPORTUNITY = 'OPPORTUNITY',
  CUSTOMER = 'CUSTOMER',
  EVANGELIST = 'EVANGELIST',
  OTHER = 'OTHER'
}

export enum CRMSalesStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  NEEDS_ANALYSIS = 'NEEDS_ANALYSIS',
  VALUE_PROPOSITION = 'VALUE_PROPOSITION',
  PROPOSAL_PRICE_QUOTE = 'PROPOSAL_PRICE_QUOTE',
  NEGOTIATION_REVIEW = 'NEGOTIATION_REVIEW',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST'
}

export enum CRMActivityType {
  TASK = 'TASK',
  CALL = 'CALL',
  MEETING = 'MEETING',
  EMAIL = 'EMAIL',
  NOTE = 'NOTE',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP'
}

export enum CRMActivityStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE'
}

export enum CRMLostReason {
  PRICE = 'PRICE',
  COMPETITOR = 'COMPETITOR',
  NO_DECISION = 'NO_DECISION',
  TIMING = 'TIMING',
  FEATURES = 'FEATURES',
  RELATIONSHIP = 'RELATIONSHIP',
  BUDGET = 'BUDGET',
  OTHER = 'OTHER'
}

export enum CRMRelatedType {
  LEAD = 'LEAD',
  CONTACT = 'CONTACT',
  DEAL = 'DEAL',
  OPPORTUNITY = 'OPPORTUNITY',
  COMPANY = 'COMPANY',
  TICKET = 'TICKET'
}

export enum CRMFilterOperator {
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  IS_EMPTY = 'IS_EMPTY',
  IS_NOT_EMPTY = 'IS_NOT_EMPTY'
}

// Request/Response Types
export interface CRMLeadCreateRequest {
  title: string;
  description?: string;
  customerId?: string;
  customer?: CRMCustomerCreateRequest;
  status?: CRMLeadStatus;
  priority?: CRMPriority;
  source?: CRMLeadSource;
  value?: number;
  currency?: string;
  assignedTo?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface CRMCustomerCreateRequest {
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  company?: string;
  jobTitle?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  lifecycleStage?: CRMLifecycleStage;
}

export interface CRMOpportunityCreateRequest {
  title: string;
  description?: string;
  leadId: string;
  customerId: string;
  stage?: CRMSalesStage;
  probability?: number;
  value: number;
  currency?: string;
  expectedCloseDate?: Date;
  assignedTo?: string;
  products?: CRMProduct[];
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface CRMActivityCreateRequest {
  type: CRMActivityType;
  title: string;
  description?: string;
  dueDate?: Date;
  status?: CRMActivityStatus;
  priority?: CRMPriority;
  assignedTo?: string;
  relatedTo: {
    type: CRMRelatedType;
    id: string;
  };
  participants?: string[];
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface CRMLeadFilter {
  status?: CRMLeadStatus[];
  priority?: CRMPriority[];
  source?: CRMLeadSource[];
  assignedTo?: string[];
  tags?: string[];
  scoreMin?: number;
  scoreMax?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

export interface CRMCustomerFilter {
  lifecycleStage?: CRMLifecycleStage[];
  leadScoreMin?: number;
  leadScoreMax?: number;
  tags?: string[];
  assignedTo?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

export interface CRMOpportunityFilter {
  stage?: CRMSalesStage[];
  assignedTo?: string[];
  probabilityMin?: number;
  probabilityMax?: number;
  valueMin?: number;
  valueMax?: number;
  expectedCloseAfter?: Date;
  expectedCloseBefore?: Date;
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

export interface CRMActivityFilter {
  type?: CRMActivityType[];
  status?: CRMActivityStatus[];
  priority?: CRMPriority[];
  assignedTo?: string[];
  relatedToType?: CRMRelatedType[];
  dueAfter?: Date;
  dueBefore?: Date;
  completedAfter?: Date;
  completedBefore?: Date;
  tags?: string[];
  search?: string;
}

export interface CRMLeadResponse extends CRMLead {
  customer: CRMCustomer;
  assignedUser?: CRMUser;
  activities: CRMActivity[];
  opportunities: CRMOpportunity[];
}

export interface CRMCustomerResponse extends CRMCustomer {
  leads: CRMLead[];
  opportunities: CRMOpportunity[];
  activities: CRMActivity[];
  assignedUser?: CRMUser;
}

export interface CRMOpportunityResponse extends CRMOpportunity {
  lead: CRMLead;
  customer: CRMCustomer;
  assignedUser?: CRMUser;
  activities: CRMActivity[];
}

export interface CRMUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

export interface CRMLeadScoringResult {
  leadId: string;
  score: number;
  breakdown: CRMScoringBreakdown[];
  factors: CRMScoringFactor[];
  grade: CRMLeadGrade;
  recommendations: string[];
}

export interface CRMScoringBreakdown {
  ruleId: string;
  ruleName: string;
  score: number;
  matched: boolean;
}

export interface CRMScoringFactor {
  category: CRMScoringCategory;
  score: number;
  weight: number;
}

export enum CRMLeadGrade {
  A_PLUS = 'A+',
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F'
}

export enum CRMScoringCategory {
  DEMOGRAPHIC = 'DEMOGRAPHIC',
  FIRMGRAPHIC = 'FIRMGRAPHIC',
  BEHAVIORAL = 'BEHAVIORAL',
  ENGAGEMENT = 'ENGAGEMENT',
  INTENT = 'INTENT'
}

export interface CRMDashboardStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  totalOpportunities: number;
  totalValue: number;
  weightedValue: number;
  conversionRate: number;
  avgDealSize: number;
  salesCycleLength: number;
  topPerformers: CRMTopPerformer[];
  recentActivities: CRMActivity[];
  pipelineDistribution: CRMPipelineDistribution[];
}

export interface CRMTopPerformer {
  userId: string;
  userName: string;
  dealsClosed: number;
  revenue: number;
  conversionRate: number;
}

export interface CRMPipelineDistribution {
  stage: CRMSalesStage;
  count: number;
  value: number;
  percentage: number;
}
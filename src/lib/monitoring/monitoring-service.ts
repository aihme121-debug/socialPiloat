import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    authentication: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
    external_services: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      services: {
        facebook: {
          status: 'healthy' | 'unhealthy';
          responseTime?: number;
          error?: string;
        };
        instagram: {
          status: 'healthy' | 'unhealthy';
          responseTime?: number;
          error?: string;
        };
      };
    };
  };
  metrics: {
    uptime: number;
    total_requests: number;
    error_rate: number;
    average_response_time: number;
  };
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Map<string, number> = new Map();
  private startTime: number = Date.now();

  private constructor() {}

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number): void {
    this.metrics.set(name, (this.metrics.get(name) || 0) + value);
  }

  /**
   * Get all metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    const checks: HealthCheck['checks'] = {
      database: await this.checkDatabase(),
      authentication: await this.checkAuthentication(),
      external_services: await this.checkExternalServices(),
    };

    // Determine overall status
    let status: HealthCheck['status'] = 'healthy';
    const allChecks = [
      checks.database.status,
      checks.authentication.status,
      checks.external_services.status,
    ];

    if (allChecks.includes('unhealthy')) {
      status = 'unhealthy';
    } else if (allChecks.includes('degraded')) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        uptime: Date.now() - this.startTime,
        total_requests: this.metrics.get('total_requests') || 0,
        error_rate: this.calculateErrorRate(),
        average_response_time: this.metrics.get('avg_response_time') || 0,
      },
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheck['checks']['database']> {
    const startTime = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check authentication system
   */
  private async checkAuthentication(): Promise<HealthCheck['checks']['authentication']> {
    try {
      // Test authentication configuration
      const authConfig = await authOptions;
      if (!authConfig.providers || authConfig.providers.length === 0) {
        throw new Error('No authentication providers configured');
      }
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown authentication error',
      };
    }
  }

  /**
   * Check external services
   */
  private async checkExternalServices(): Promise<HealthCheck['checks']['external_services']> {
    const services = {
      facebook: await this.checkFacebookAPI(),
      instagram: await this.checkInstagramAPI(),
    };

    const statuses = Object.values(services).map(s => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('healthy') && statuses.includes('unhealthy')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      services,
    };
  }

  /**
   * Check Facebook API connectivity
   */
  private async checkFacebookAPI(): Promise<HealthCheck['checks']['external_services']['services']['facebook']> {
    try {
      // Simple Facebook API health check
      const response = await fetch('https://graph.facebook.com/v18.0/me', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: response.headers.get('x-response-time') ? 
          parseInt(response.headers.get('x-response-time')!) : undefined,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Facebook API unavailable',
      };
    }
  }

  /**
   * Check Instagram API connectivity
   */
  private async checkInstagramAPI(): Promise<HealthCheck['checks']['external_services']['services']['instagram']> {
    try {
      // Simple Instagram API health check
      const response = await fetch('https://graph.facebook.com/v18.0/instagram-business-account', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: response.headers.get('x-response-time') ? 
          parseInt(response.headers.get('x-response-time')!) : undefined,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Instagram API unavailable',
      };
    }
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const totalRequests = this.metrics.get('total_requests') || 0;
    const errorRequests = this.metrics.get('error_requests') || 0;
    
    if (totalRequests === 0) return 0;
    return (errorRequests / totalRequests) * 100;
  }

  /**
   * Log application error
   */
  logError(error: Error, context?: Record<string, any>): void {
    this.recordMetric('error_requests', 1);
    
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
    };

    // In production, this would send to external logging service
    console.error('Application Error:', errorLog);
  }

  /**
   * Log security events for monitoring and alerting
   */
  logSecurityEvent(event: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    userId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): void {
    this.recordMetric('security_events', 1);
    
    const securityLog = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    // In production, this would send to SIEM/security service
    console.log(`[SECURITY] ${event.severity.toUpperCase()}: ${event.type} - ${event.message}`);
    
    // For high/critical severity, you might want to trigger alerts
    if (event.severity === 'high' || event.severity === 'critical') {
      console.warn('HIGH PRIORITY SECURITY EVENT - Consider alerting:', securityLog);
    }
  }

  /**
   * Log performance metric
   */
  logPerformance(metricName: string, duration: number, metadata?: Record<string, any>): void {
    this.recordMetric(metricName, duration);
    
    const performanceLog = {
      timestamp: new Date().toISOString(),
      metric: metricName,
      duration,
      metadata,
    };

    // In production, this would send to external monitoring service
    console.log('Performance Metric:', performanceLog);
  }
}

export const monitoringService = MonitoringService.getInstance();
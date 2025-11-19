const EventEmitter = require('events');
const { systemMonitor } = require('../system/system-monitor-js');

/**
 * JavaScript version of FacebookConnectionManager
 */
class FacebookConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.config = {
      maxRetries: 5,
      retryDelay: 5000,
      healthCheckInterval: 30000,
      connectionTimeout: 10000
    };
    
    this.connectionStatus = {
      webhook: {
        connected: false,
        lastConnection: new Date().toISOString(),
        reconnectAttempts: 0,
        errorCount: 0
      },
      api: {
        connected: false,
        lastConnection: new Date().toISOString(),
        reconnectAttempts: 0,
        errorCount: 0
      }
    };
    
    this.healthCheckInterval = null;
    this.retryTimeouts = new Map();
    this.isShuttingDown = false;
  }

  /**
   * Initialize the connection manager
   */
  async initialize() {
    console.log('🔧 Facebook Connection Manager initializing...');
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    // Attempt initial connections
    await this.connectWebhook();
    await this.connectApi();
    
    console.log('✅ Facebook Connection Manager initialized');
  }

  /**
   * Connect to Facebook webhook
   */
  async connectWebhook() {
    try {
      console.log('📘 Connecting to Facebook webhook...');
      
      // Test webhook endpoint
      const webhookUrl = process.env.FACEBOOK_WEBHOOK_URL || 'http://localhost:7070/api/facebook/webhook';
      const response = await this.testEndpoint(webhookUrl);
      
      if (response.success) {
        this.connectionStatus.webhook.connected = true;
        this.connectionStatus.webhook.lastConnection = new Date().toISOString();
        this.connectionStatus.webhook.reconnectAttempts = 0;
        
        systemMonitor.updateFacebookWebhookStatus(true);
        console.log('✅ Facebook webhook connected');
        this.emit('webhook-connected');
        return true;
      } else {
        throw new Error(response.error || 'Webhook test failed');
      }
    } catch (error) {
      this.connectionStatus.webhook.connected = false;
      this.connectionStatus.webhook.lastConnection = new Date().toISOString();
      this.connectionStatus.webhook.errorCount++;
      
      systemMonitor.updateFacebookWebhookStatus(false, error.message);
      console.error('❌ Facebook webhook connection failed:', error.message);
      this.emit('webhook-error', error);
      
      // Schedule retry
      this.scheduleRetry('webhook', () => this.connectWebhook());
      return false;
    }
  }

  /**
   * Connect to Facebook API
   */
  async connectApi() {
    try {
      console.log('📘 Connecting to Facebook API...');
      
      // Test Facebook Graph API
      const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('FACEBOOK_ACCESS_TOKEN not configured');
      }
      
      const apiUrl = `https://graph.facebook.com/v18.0/me?access_token=${accessToken}`;
      const response = await fetch(apiUrl);
      
      if (response.ok) {
        const data = await response.json();
        this.connectionStatus.api.connected = true;
        this.connectionStatus.api.lastConnection = new Date().toISOString();
        this.connectionStatus.api.reconnectAttempts = 0;
        
        systemMonitor.updateFacebookApiStatus('connected', response.headers.get('x-fb-debug') ? 200 : 0);
        console.log('✅ Facebook API connected');
        this.emit('api-connected', data);
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API error: ${response.status}`);
      }
    } catch (error) {
      this.connectionStatus.api.connected = false;
      this.connectionStatus.api.lastConnection = new Date().toISOString();
      this.connectionStatus.api.errorCount++;
      
      systemMonitor.updateFacebookApiStatus('error', 0, error.message);
      console.error('❌ Facebook API connection failed:', error.message);
      this.emit('api-error', error);
      
      // Schedule retry
      this.scheduleRetry('api', () => this.connectApi());
      return false;
    }
  }

  /**
   * Test endpoint connectivity
   */
  async testEndpoint(url) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: this.config.connectionTimeout
      });
      
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      console.log('🔍 Running health check...');
      
      // Check webhook connection
      if (!this.connectionStatus.webhook.connected) {
        console.log('🔄 Attempting webhook reconnection...');
        await this.connectWebhook();
      }
      
      // Check API connection
      if (!this.connectionStatus.api.connected) {
        console.log('🔄 Attempting API reconnection...');
        await this.connectApi();
      }
      
      // Emit health status
      this.emit('health-check', {
        webhook: this.connectionStatus.webhook.connected,
        api: this.connectionStatus.api.connected,
        timestamp: new Date().toISOString()
      });
      
    }, this.config.healthCheckInterval);
  }

  /**
   * Schedule retry with exponential backoff
   */
  scheduleRetry(type, retryFunction) {
    if (this.isShuttingDown) return;
    
    const key = `${type}-retry`;
    
    // Clear existing retry timeout
    if (this.retryTimeouts.has(key)) {
      clearTimeout(this.retryTimeouts.get(key));
    }
    
    const attempts = this.connectionStatus[type].reconnectAttempts;
    const delay = Math.min(
      this.config.retryDelay * Math.pow(2, attempts),
      60000 // Max 1 minute delay
    );
    
    console.log(`⏰ Scheduling ${type} retry in ${delay}ms (attempt ${attempts + 1})`);
    
    const timeout = setTimeout(() => {
      this.connectionStatus[type].reconnectAttempts++;
      systemMonitor.logFacebookReconnectAttempt();
      retryFunction();
    }, delay);
    
    this.retryTimeouts.set(key, timeout);
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      webhook: { ...this.connectionStatus.webhook },
      api: { ...this.connectionStatus.api }
    };
  }

  /**
   * Disconnect all connections
   */
  async disconnect() {
    console.log('🛑 Disconnecting Facebook connections...');
    this.isShuttingDown = true;
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Clear all retry timeouts
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts.clear();
    
    // Update connection status
    this.connectionStatus.webhook.connected = false;
    this.connectionStatus.api.connected = false;
    
    // Update system monitor
    systemMonitor.updateFacebookWebhookStatus(false, 'Manual disconnect');
    systemMonitor.updateFacebookApiStatus('disconnected', 0);
    
    console.log('✅ Facebook connections disconnected');
    this.emit('disconnected');
  }

  /**
   * Test Facebook page subscription
   */
  async testPageSubscription(pageId, accessToken) {
    try {
      const url = `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps?access_token=${accessToken}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
          subscribed: data.data && data.data.length > 0
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || 'Subscription test failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
let instance = null;

const getFacebookConnectionManager = () => {
  if (!instance) {
    instance = new FacebookConnectionManager();
  }
  return instance;
};

module.exports = {
  FacebookConnectionManager,
  facebookConnectionManager: getFacebookConnectionManager()
};
#!/usr/bin/env node

/**
 * Comprehensive Facebook Integration Test Script
 * Tests all aspects of Facebook integration including webhooks, API endpoints, and real-time updates
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:7070';
const FACEBOOK_WEBHOOK_VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'messages';

// Test data
const TEST_PAGE_ID = process.env.TEST_PAGE_ID || '832877782728202';
const TEST_SENDER_ID = process.env.TEST_SENDER_ID || '26056355673954643';
const TEST_WEBHOOK_DATA = {
  object: 'page',
  entry: [{
    id: TEST_PAGE_ID,
    time: Date.now(),
    messaging: [{
      sender: { id: TEST_SENDER_ID },
      recipient: { id: TEST_PAGE_ID },
      timestamp: Date.now(),
      message: {
        mid: 'test_message_id_' + Date.now(),
        text: 'Test message from comprehensive test script'
      }
    }]
  }]
};

class FacebookIntegrationTester {
  constructor() {
    this.testResults = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async testWebhookVerification() {
    this.log('Testing Facebook webhook verification...');
    
    try {
      const challenge = 'test_challenge_' + Date.now();
      const response = await axios.get(`${BASE_URL}/api/facebook/webhook`, {
        params: {
          'hub.mode': 'subscribe',
          'hub.verify_token': FACEBOOK_WEBHOOK_VERIFY_TOKEN,
          'hub.challenge': challenge
        }
      });

      if (response.data === challenge) {
        this.log('Webhook verification successful', 'success');
        this.testResults.push({ test: 'Webhook Verification', status: 'PASSED' });
        this.passedTests++;
        return true;
      } else {
        throw new Error(`Expected challenge ${challenge}, got ${response.data}`);
      }
    } catch (error) {
      this.log(`Webhook verification failed: ${error.message}`, 'error');
      this.testResults.push({ test: 'Webhook Verification', status: 'FAILED', error: error.message });
      this.failedTests++;
      return false;
    }
  }

  async testWebhookMessageProcessing() {
    this.log('Testing Facebook webhook message processing...');
    
    try {
      const response = await axios.post(
        `${BASE_URL}/api/facebook/webhook`,
        TEST_WEBHOOK_DATA,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature': 'sha1=test_signature'
          }
        }
      );

      if (response.status === 200) {
        this.log('Webhook message processing successful', 'success');
        this.testResults.push({ test: 'Webhook Message Processing', status: 'PASSED' });
        this.passedTests++;
        return true;
      } else {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
    } catch (error) {
      this.log(`Webhook message processing failed: ${error.message}`, 'error');
      this.testResults.push({ test: 'Webhook Message Processing', status: 'FAILED', error: error.message });
      this.failedTests++;
      return false;
    }
  }

  async testStoredConversationsEndpoint() {
    this.log('Testing stored conversations endpoint...');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/facebook/conversations/stored/test`);
      
      if (response.status === 200 && response.data.success) {
        this.log(`Stored conversations endpoint working - found ${response.data.count} conversations`, 'success');
        this.testResults.push({ test: 'Stored Conversations Endpoint', status: 'PASSED' });
        this.passedTests++;
        return true;
      } else {
        throw new Error(`Invalid response format or status: ${response.status}`);
      }
    } catch (error) {
      this.log(`Stored conversations endpoint failed: ${error.message}`, 'error');
      this.testResults.push({ test: 'Stored Conversations Endpoint', status: 'FAILED', error: error.message });
      this.failedTests++;
      return false;
    }
  }

  async testStoredMessagesEndpoint() {
    this.log('Testing stored messages endpoint...');
    
    try {
      // First get a conversation ID
      const conversationsResponse = await axios.get(`${BASE_URL}/api/facebook/conversations/stored/test`);
      
      if (conversationsResponse.data.conversations.length > 0) {
        const conversationId = conversationsResponse.data.conversations[0].id;
        const messagesResponse = await axios.get(`${BASE_URL}/api/facebook/conversations/${conversationId}/messages/stored/test`);
        
        if (messagesResponse.status === 200 && messagesResponse.data.success) {
          this.log(`Stored messages endpoint working - found ${messagesResponse.data.count} messages`, 'success');
          this.testResults.push({ test: 'Stored Messages Endpoint', status: 'PASSED' });
          this.passedTests++;
          return true;
        } else {
          throw new Error(`Invalid messages response format or status: ${messagesResponse.status}`);
        }
      } else {
        this.log('No conversations found for messages test', 'info');
        this.testResults.push({ test: 'Stored Messages Endpoint', status: 'SKIPPED - No conversations' });
        return true;
      }
    } catch (error) {
      this.log(`Stored messages endpoint failed: ${error.message}`, 'error');
      this.testResults.push({ test: 'Stored Messages Endpoint', status: 'FAILED', error: error.message });
      this.failedTests++;
      return false;
    }
  }

  async testDatabaseMessageStorage() {
    this.log('Testing database message storage...');
    
    try {
      // Check if the test message was stored
      const messages = await prisma.chatMessage.findMany({
        where: {
          platform: 'FACEBOOK',
          messageId: TEST_WEBHOOK_DATA.entry[0].messaging[0].message.mid
        }
      });

      if (messages.length > 0) {
        this.log(`Database message storage working - found ${messages.length} stored messages`, 'success');
        this.testResults.push({ test: 'Database Message Storage', status: 'PASSED' });
        this.passedTests++;
        return true;
      } else {
        throw new Error('Test message not found in database');
      }
    } catch (error) {
      this.log(`Database message storage test failed: ${error.message}`, 'error');
      this.testResults.push({ test: 'Database Message Storage', status: 'FAILED', error: error.message });
      this.failedTests++;
      return false;
    }
  }

  async testSystemMonitorStatus() {
    this.log('Testing system monitor status...');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/admin/system-status`);
      
      if (response.status === 200 && response.data) {
        const { serverStatus, facebookWebhook, socketIO, ngrokTunnel } = response.data;
        
        this.log(`System Monitor Status:`, 'info');
        this.log(`  Server: ${serverStatus?.status || 'N/A'} (Port: ${serverStatus?.port || 'N/A'})`, 'info');
        this.log(`  Facebook Webhook: ${facebookWebhook?.status || 'N/A'}`, 'info');
        this.log(`  Socket.IO: ${socketIO?.status || 'N/A'}`, 'info');
        this.log(`  ngrok Tunnel: ${ngrokTunnel?.status || 'N/A'}`, 'info');
        
        this.testResults.push({ test: 'System Monitor Status', status: 'PASSED' });
        this.passedTests++;
        return true;
      } else {
        throw new Error(`Invalid system monitor response: ${response.status}`);
      }
    } catch (error) {
      this.log(`System monitor status test failed: ${error.message}`, 'error');
      this.testResults.push({ test: 'System Monitor Status', status: 'FAILED', error: error.message });
      this.failedTests++;
      return false;
    }
  }

  async testRealTimeUpdates() {
    this.log('Testing real-time updates...');
    
    try {
      // Test Socket.IO connection
      const io = require('socket.io-client');
      const socket = io(BASE_URL, { path: '/socket.io', transports: ['websocket','polling'] });
      
      return new Promise((resolve) => {
        let updateReceived = false;
        
        socket.on('connect', () => {
          this.log('Socket.IO connection established', 'success');
          
          // Listen for message updates
          socket.on('new-message', (data) => {
            this.log('Real-time message update received', 'success');
            updateReceived = true;
            socket.disconnect();
            
            this.testResults.push({ test: 'Real-time Updates', status: 'PASSED' });
            this.passedTests++;
            resolve(true);
          });
          
          // Send a test message after connection
          setTimeout(async () => {
            if (!updateReceived) {
              try {
                await axios.post(`${BASE_URL}/api/facebook/webhook`, TEST_WEBHOOK_DATA, {
                  headers: { 'Content-Type': 'application/json' }
                });
              } catch (error) {
                this.log(`Failed to send test webhook: ${error.message}`, 'error');
              }
            }
          }, 1000);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            if (!updateReceived) {
              socket.disconnect();
              this.log('Real-time updates test timed out', 'error');
              this.testResults.push({ test: 'Real-time Updates', status: 'FAILED', error: 'Timeout' });
              this.failedTests++;
              resolve(false);
            }
          }, 5000);
        });
        
        socket.on('connect_error', (error) => {
          this.log(`Socket.IO connection failed: ${error.message}`, 'error');
          this.testResults.push({ test: 'Real-time Updates', status: 'FAILED', error: error.message });
          this.failedTests++;
          resolve(false);
        });
      });
    } catch (error) {
      this.log(`Real-time updates test failed: ${error.message}`, 'error');
      this.testResults.push({ test: 'Real-time Updates', status: 'FAILED', error: error.message });
      this.failedTests++;
      return false;
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Comprehensive Facebook Integration Tests', 'info');
    this.log('='.repeat(60), 'info');
    
    try {
      // Run all tests
      await this.testWebhookVerification();
      await this.testWebhookMessageProcessing();
      await this.testStoredConversationsEndpoint();
      await this.testStoredMessagesEndpoint();
      await this.testDatabaseMessageStorage();
      await this.testSystemMonitorStatus();
      await this.testRealTimeUpdates();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
    } finally {
      await prisma.$disconnect();
    }
  }

  generateReport() {
    this.log('='.repeat(60), 'info');
    this.log('📊 COMPREHENSIVE TEST REPORT', 'info');
    this.log('='.repeat(60), 'info');
    
    this.testResults.forEach((result, index) => {
      const status = result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⚠️';
      this.log(`${index + 1}. ${result.test}: ${status} ${result.status}`, result.status === 'PASSED' ? 'success' : 'error');
      if (result.error) {
        this.log(`   Error: ${result.error}`, 'error');
      }
    });
    
    this.log('='.repeat(60), 'info');
    this.log(`Total Tests: ${this.testResults.length}`, 'info');
    this.log(`✅ Passed: ${this.passedTests}`, 'success');
    this.log(`❌ Failed: ${this.failedTests}`, 'error');
    this.log(`⚠️ Skipped: ${this.testResults.length - this.passedTests - this.failedTests}`, 'info');
    
    const successRate = this.testResults.length > 0 ? (this.passedTests / this.testResults.length * 100).toFixed(1) : 0;
    this.log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'success' : 'error');
    
    if (this.failedTests === 0) {
      this.log('🎉 ALL TESTS PASSED! Facebook integration is working correctly.', 'success');
    } else {
      this.log('⚠️ Some tests failed. Please review the errors above and fix the issues.', 'error');
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new FacebookIntegrationTester();
  tester.runAllTests().catch(console.error);
}

module.exports = FacebookIntegrationTester;
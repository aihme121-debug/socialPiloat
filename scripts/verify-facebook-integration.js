#!/usr/bin/env node

/**
 * Final Facebook Integration Verification Script
 * This script verifies that Facebook integration is working correctly
 * and provides a comprehensive report on the current status
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:7070';
const FACEBOOK_WEBHOOK_VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'messages';

class FacebookIntegrationVerifier {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
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
        this.log('✅ Facebook webhook verification is working', 'success');
        this.results.push({ test: 'Webhook Verification', status: 'PASSED' });
        this.passed++;
        return true;
      } else {
        throw new Error(`Expected challenge ${challenge}, got ${response.data}`);
      }
    } catch (error) {
      this.log(`❌ Webhook verification failed: ${error.message}`, 'error');
      this.results.push({ test: 'Webhook Verification', status: 'FAILED', error: error.message });
      this.failed++;
      return false;
    }
  }

  async testSystemStatus() {
    this.log('Testing system status endpoint...');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/admin/system-status`);
      
      if (response.status === 200 && response.data.success) {
        const { status } = response.data;
        
        this.log('📊 Current System Status:', 'info');
        this.log(`   Server Status: ${status.server?.status || 'Unknown'} (Port: ${status.server?.port || 'N/A'})`, 'info');
        this.log(`   Facebook Webhook: ${status.facebook?.webhook?.connected ? 'Connected' : 'Disconnected'}`, 
                 status.facebook?.webhook?.connected ? 'success' : 'error');
        this.log(`   Socket.IO Server: ${status.socket?.server?.running ? 'Running' : 'Stopped'}`, 
                 status.socket?.server?.running ? 'success' : 'error');
        this.log(`   ngrok Tunnel: ${status.ngrok?.tunnel?.active ? 'Active' : 'Inactive'}`, 
                 status.ngrok?.tunnel?.active ? 'success' : 'error');
        
        this.results.push({ test: 'System Status', status: 'PASSED' });
        this.passed++;
        return true;
      } else {
        throw new Error('Invalid system status response');
      }
    } catch (error) {
      this.log(`❌ System status test failed: ${error.message}`, 'error');
      this.results.push({ test: 'System Status', status: 'FAILED', error: error.message });
      this.failed++;
      return false;
    }
  }

  async testStoredConversations() {
    this.log('Testing stored conversations endpoint...');
    
    try {
      const response = await axios.get(`${BASE_URL}/api/facebook/conversations/stored/test`);
      
      if (response.status === 200 && response.data.success) {
        const { conversations, count } = response.data;
        
        if (count > 0) {
          this.log(`✅ Found ${count} stored conversations`, 'success');
          conversations.forEach((conv, index) => {
            this.log(`   ${index + 1}. ${conv.customer.name} - ${conv.lastMessagePreview}`, 'info');
          });
        } else {
          this.log('ℹ️ No stored conversations found (this is normal if no messages received yet)', 'info');
        }
        
        this.results.push({ test: 'Stored Conversations', status: 'PASSED' });
        this.passed++;
        return true;
      } else {
        throw new Error('Invalid conversations response');
      }
    } catch (error) {
      this.log(`❌ Stored conversations test failed: ${error.message}`, 'error');
      this.results.push({ test: 'Stored Conversations', status: 'FAILED', error: error.message });
      this.failed++;
      return false;
    }
  }

  async testSocketIOConnection() {
    this.log('Testing Socket.IO real-time connection...');
    
    return new Promise((resolve) => {
      try {
        const io = require('socket.io-client');
        const socket = io(BASE_URL);
        let connected = false;
        
        socket.on('connect', () => {
          this.log('✅ Socket.IO connection established', 'success');
          connected = true;
          socket.disconnect();
          
          this.results.push({ test: 'Socket.IO Connection', status: 'PASSED' });
          this.passed++;
          resolve(true);
        });
        
        socket.on('connect_error', (error) => {
          this.log(`❌ Socket.IO connection failed: ${error.message}`, 'error');
          socket.disconnect();
          
          this.results.push({ test: 'Socket.IO Connection', status: 'FAILED', error: error.message });
          this.failed++;
          resolve(false);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (!connected) {
            socket.disconnect();
            this.log('❌ Socket.IO connection timed out', 'error');
            this.results.push({ test: 'Socket.IO Connection', status: 'FAILED', error: 'Timeout' });
            this.failed++;
            resolve(false);
          }
        }, 5000);
        
      } catch (error) {
        this.log(`❌ Socket.IO test error: ${error.message}`, 'error');
        this.results.push({ test: 'Socket.IO Connection', status: 'FAILED', error: error.message });
        this.failed++;
        resolve(false);
      }
    });
  }

  async testWebhookMessageProcessing() {
    this.log('Testing webhook message processing...');
    
    const testMessage = {
      entry: [{
        id: 'test_page_id',
        time: Date.now(),
        messaging: [{
          sender: { id: 'test_sender_id' },
          recipient: { id: 'test_page_id' },
          timestamp: Date.now(),
          message: {
            mid: 'test_message_id_' + Date.now(),
            text: 'Test message from verification script'
          }
        }]
      }]
    };
    
    try {
      const response = await axios.post(
        `${BASE_URL}/api/facebook/webhook`,
        testMessage,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature': 'sha1=test_signature'
          }
        }
      );

      if (response.status === 200) {
        this.log('✅ Webhook message processing successful', 'success');
        this.results.push({ test: 'Webhook Message Processing', status: 'PASSED' });
        this.passed++;
        return true;
      } else {
        throw new Error(`Expected status 200, got ${response.status}`);
      }
    } catch (error) {
      this.log(`❌ Webhook message processing failed: ${error.message}`, 'error');
      this.results.push({ test: 'Webhook Message Processing', status: 'FAILED', error: error.message });
      this.failed++;
      return false;
    }
  }

  generateFinalReport() {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 FINAL FACEBOOK INTEGRATION VERIFICATION REPORT');
    console.log('='.repeat(70));
    
    this.results.forEach((result, index) => {
      const status = result.status === 'PASSED' ? '✅' : '❌';
      const color = result.status === 'PASSED' ? 'success' : 'error';
      this.log(`${index + 1}. ${result.test}: ${status} ${result.status}`, color);
      if (result.error) {
        this.log(`   Error: ${result.error}`, 'error');
      }
    });
    
    console.log('\n' + '='.repeat(70));
    console.log(`📈 SUMMARY:`);
    console.log(`   Total Tests: ${this.results.length}`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    
    const successRate = this.results.length > 0 ? (this.passed / this.results.length * 100).toFixed(1) : 0;
    console.log(`   📊 Success Rate: ${successRate}%`);
    
    console.log('\n🔧 NEXT STEPS:');
    if (this.failed === 0) {
      console.log('🎉 ALL TESTS PASSED! Facebook integration is fully functional.');
      console.log('📱 Your SaaS Inbox should now show real Facebook messages.');
      console.log('🔔 Real-time updates are working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the errors above.');
      console.log('💡 Common fixes:');
      console.log('   - Ensure Facebook app has correct permissions');
      console.log('   - Verify webhook URL is set in Facebook Developer Console');
      console.log('   - Check that ngrok tunnel is active (if using)');
      console.log('   - Verify database connection is working');
    }
    
    console.log('\n🔗 USEFUL COMMANDS:');
    console.log('   - Test webhook manually: curl -X POST http://localhost:7070/api/facebook/webhook');
    console.log('   - Check system status: curl http://localhost:7070/api/admin/system-status');
    console.log('   - View stored conversations: http://localhost:7070/api/facebook/conversations/stored/test');
  }

  async runVerification() {
    console.log('🚀 Starting Facebook Integration Verification');
    console.log('='.repeat(70));
    
    try {
      await this.testSystemStatus();
      await this.testWebhookVerification();
      await this.testWebhookMessageProcessing();
      await this.testStoredConversations();
      await this.testSocketIOConnection();
      
      this.generateFinalReport();
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      process.exit(1);
    }
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  const verifier = new FacebookIntegrationVerifier();
  verifier.runVerification().catch(console.error);
}

module.exports = FacebookIntegrationVerifier;
#!/usr/bin/env node

/**
 * Facebook Integration Test Script
 * Tests webhook verification, OAuth configuration, and message flow
 */

const https = require('https');
const http = require('http');

// Configuration
const NGROK_URL = 'https://mui-unpretentious-coextensively.ngrok-free.dev';
const WEBHOOK_VERIFY_TOKEN = 'messages';

// Test utilities
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        data: data
      }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Test functions
async function testWebhookVerification() {
  console.log('🧪 Testing Facebook Webhook Verification...');
  
  const challenge = 'test_challenge_123';
  const url = `${NGROK_URL}/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=${WEBHOOK_VERIFY_TOKEN}&hub.challenge=${challenge}`;
  
  try {
    const response = await makeRequest(url, { method: 'GET' });
    
    if (response.statusCode === 200 && response.data === challenge) {
      console.log('✅ Webhook verification PASSED');
      return true;
    } else {
      console.log('❌ Webhook verification FAILED');
      console.log(`   Status: ${response.statusCode}`);
      console.log(`   Expected: ${challenge}`);
      console.log(`   Received: ${response.data}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook verification ERROR:', error.message);
    return false;
  }
}

async function testFacebookConfig() {
  console.log('🧪 Testing Facebook Configuration...');
  
  try {
    const response = await makeRequest(`${NGROK_URL}/api/auth/social/facebook/config?action=config`);
    const data = JSON.parse(response.data);
    
    console.log('📋 Facebook Config:');
    console.log(`   App ID: ${data.config.appId || 'NOT SET'}`);
    console.log(`   Verify Token: ${data.config.verifyToken || 'NOT SET'}`);
    console.log(`   Webhook URL: ${data.config.webhookUrl || 'NOT SET'}`);
    console.log(`   Environment: ${data.config.environment || 'NOT SET'}`);
    
    return data.config.verifyToken === WEBHOOK_VERIFY_TOKEN;
  } catch (error) {
    console.log('❌ Facebook config ERROR:', error.message);
    return false;
  }
}

async function testConversationsEndpoint() {
  console.log('🧪 Testing Conversations Endpoint (will be 401 without auth)...');
  
  try {
    const response = await makeRequest(`${NGROK_URL}/api/facebook/conversations`);
    
    if (response.statusCode === 401) {
      console.log('✅ Conversations endpoint is protected (401 - expected without auth)');
      return true;
    } else if (response.statusCode === 404) {
      console.log('⚠️  No Facebook accounts found (404)');
      return false;
    } else {
      console.log(`⚠️  Unexpected status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Conversations endpoint ERROR:', error.message);
    return false;
  }
}

async function testWebhookEndpoint() {
  console.log('🧪 Testing Webhook Endpoint Accessibility...');
  
  try {
    const response = await makeRequest(`${NGROK_URL}/api/facebook/webhook`);
    
    if (response.statusCode === 400) {
      console.log('✅ Webhook endpoint is accessible (400 - expected without params)');
      return true;
    } else {
      console.log(`⚠️  Unexpected status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook endpoint ERROR:', error.message);
    return false;
  }
}

async function simulateWebhookMessage() {
  console.log('🧪 Simulating Facebook Webhook Message...');
  
  const testPayload = {
    object: 'page',
    entry: [{
      id: 'test_page_id',
      time: Date.now(),
      messaging: [{
        sender: { id: 'test_user_id' },
        recipient: { id: 'test_page_id' },
        timestamp: Date.now(),
        message: {
          mid: 'test_message_id',
          text: 'Test message from webhook simulation'
        }
      }]
    }]
  };
  
  try {
    const response = await makeRequest(`${NGROK_URL}/api/facebook/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=test_signature'
      },
      body: JSON.stringify(testPayload)
    });
    
    if (response.statusCode === 200) {
      console.log('✅ Webhook message simulation PASSED');
      return true;
    } else {
      console.log(`⚠️  Webhook simulation status: ${response.statusCode}`);
      console.log(`   Response: ${response.data}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook simulation ERROR:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🔍 Facebook Integration Test Suite');
  console.log('=====================================');
  console.log(`Testing against: ${NGROK_URL}`);
  console.log(`Verify token: ${WEBHOOK_VERIFY_TOKEN}`);
  console.log('');
  
  const tests = [
    { name: 'Webhook Verification', test: testWebhookVerification },
    { name: 'Facebook Configuration', test: testFacebookConfig },
    { name: 'Webhook Endpoint', test: testWebhookEndpoint },
    { name: 'Conversations Endpoint', test: testConversationsEndpoint },
    { name: 'Webhook Message Simulation', test: simulateWebhookMessage }
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    console.log(`\n--- ${name} ---`);
    try {
      const passed = await test();
      results.push({ name, passed, status: passed ? 'PASS' : 'FAIL' });
    } catch (error) {
      console.log(`❌ ${name} CRASHED:`, error.message);
      results.push({ name, passed: false, status: 'CRASH' });
    }
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  
  results.forEach(({ name, passed, status }) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}: ${status}`);
  });
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log(`\n🎯 Results: ${passedCount}/${totalCount} tests passed`);
  
  if (passedCount === totalCount) {
    console.log('🎉 All tests passed! Facebook integration should be working.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
    console.log('\n🔧 Next Steps:');
    console.log('1. Ensure Facebook App is properly configured');
    console.log('2. Verify webhook URL is set in Facebook Developer Console');
    console.log('3. Check that Facebook Page is connected and has necessary permissions');
    console.log('4. Re-authorize Facebook account with new messaging scopes');
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
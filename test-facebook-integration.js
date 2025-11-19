#!/usr/bin/env node

/**
 * Comprehensive Facebook Integration Test Script
 * Tests all API endpoints and fixes
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:7070';
const API_TIMEOUT = 10000;

async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
    console.log(`\n🧪 Testing ${method} ${endpoint}`);
    
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: API_TIMEOUT,
      validateStatus: () => true, // Don't throw on error status codes
    };
    
    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }
    
    const response = await axios(config);
    
    console.log(`   Status: ${response.status}`);
    if (response.status >= 400) {
      console.log(`   Error: ${response.data?.error || 'Unknown error'}`);
    } else {
      console.log(`   Success: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
    }
    
    return {
      success: response.status < 400,
      status: response.status,
      data: response.data,
      error: response.data?.error
    };
  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`);
    return {
      success: false,
      status: 0,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('🚀 Starting Facebook Integration System Tests');
  console.log('==============================================');
  
  const results = {
    systemStatus: await testEndpoint('/api/admin/system-status'),
    health: await testEndpoint('/api/health'),
    socketTest: await testEndpoint('/api/socket-test'),
    socialAccounts: await testEndpoint('/api/social-accounts'),
    facebookConversations: await testEndpoint('/api/facebook/conversations/stored'),
    facebookWebhook: await testEndpoint('/api/facebook/webhook'),
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const [testName, result] of Object.entries(results)) {
    totalTests++;
    if (result.success) {
      passedTests++;
      console.log(`✅ ${testName}: PASSED`);
    } else {
      console.log(`❌ ${testName}: FAILED (${result.error || `Status ${result.status}`})`);
    }
  }
  
  console.log(`\n📈 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! The Facebook integration system appears to be working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the detailed results above.');
    console.log('🔧 Common issues:');
    console.log('   - 401 errors: Authentication required - this is expected for protected endpoints');
    console.log('   - 404 errors: Resources not found - may need to connect Facebook accounts first');
    console.log('   - Network errors: Server may not be running on port 7070');
  }
  
  // Test specific Facebook webhook endpoint
  console.log('\n🔍 Testing Facebook Webhook Verification');
  console.log('========================================');
  
  const webhookTest = await testEndpoint(`/api/facebook/webhook?hub.mode=subscribe&hub.verify_token=messages&hub.challenge=test_challenge`, 'GET');
  if (webhookTest.success) {
    console.log('✅ Facebook webhook verification endpoint is accessible');
  } else {
    console.log('❌ Facebook webhook verification failed:', webhookTest.error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testEndpoint };
#!/usr/bin/env node

/**
 * Test Facebook Graph API Conversations
 * Check if Facebook API returns conversations with current token
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFacebookConversationsAPI() {
  try {
    console.log('🔍 Testing Facebook Graph API Conversations...\n');
    
    // Get the Facebook social account for Canva Hme business
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { 
        platform: 'FACEBOOK',
        business: {
          users: {
            some: { email: 'canvahme@gmail.com' }
          }
        },
        isActive: true
      }
    });
    
    if (!socialAccount) {
      console.log('❌ No Facebook social account found for Canva Hme business');
      return;
    }
    
    console.log(`✅ Found Facebook social account:`);
    console.log(`   Account ID: ${socialAccount.accountId}`);
    console.log(`   Has Access Token: ${socialAccount.accessToken ? '✅ YES' : '❌ NO'}`);
    
    if (!socialAccount.accessToken) {
      console.log('❌ No access token available');
      return;
    }
    
    // Test Facebook Graph API directly
    console.log('\n📡 Testing Facebook Graph API...');
    
    const url = `https://graph.facebook.com/v18.0/${socialAccount.accountId}/conversations?limit=10&access_token=${encodeURIComponent(socialAccount.accessToken)}`;
    
    console.log(`   API URL: ${url.replace(socialAccount.accessToken, '***')}`);
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`   Response Status: ${response.status}`);
      
      if (response.ok) {
        console.log(`✅ API call successful!`);
        console.log(`   Found ${data.data?.length || 0} conversations`);
        
        if (data.data && data.data.length > 0) {
          console.log('\n   Recent Conversations:');
          data.data.forEach((conv, i) => {
            console.log(`   ${i+1}. ID: ${conv.id}`);
            console.log(`      Updated: ${conv.updated_time}`);
            console.log(`      Message Count: ${conv.message_count || 'Unknown'}`);
            console.log(`      Participants: ${conv.participants?.data?.map(p => p.name).join(', ') || 'Unknown'}`);
          });
        }
      } else {
        console.log(`❌ API call failed!`);
        console.log(`   Error: ${data.error?.message || 'Unknown error'}`);
        console.log(`   Error Code: ${data.error?.code || 'Unknown'}`);
        console.log(`   Error Type: ${data.error?.type || 'Unknown'}`);
        
        if (data.error?.code === 200) {
          console.log('\n💡 This usually means missing permissions!');
          console.log('   The access token needs: read_page_mailboxes, pages_messaging');
        }
      }
      
      // Also test if we can get messages for a specific conversation
      if (data.data && data.data.length > 0) {
        const firstConv = data.data[0];
        console.log(`\n📨 Testing messages for conversation ${firstConv.id}...`);
        
        const messagesUrl = `https://graph.facebook.com/v18.0/${firstConv.id}/messages?access_token=${encodeURIComponent(socialAccount.accessToken)}`;
        
        try {
          const messagesResponse = await fetch(messagesUrl);
          const messagesData = await messagesResponse.json();
          
          if (messagesResponse.ok) {
            console.log(`✅ Messages API working! Found ${messagesData.data?.length || 0} messages`);
          } else {
            console.log(`❌ Messages API failed: ${messagesData.error?.message}`);
          }
        } catch (error) {
          console.log(`❌ Messages API error: ${error.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Fetch error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing Facebook API:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testFacebookConversationsAPI();
}

module.exports = { testFacebookConversationsAPI };
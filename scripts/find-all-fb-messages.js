#!/usr/bin/env node

/**
 * Find All Facebook Messages Regardless of Account
 * Debug where messages are actually stored
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findAllFacebookMessages() {
  try {
    console.log('🔍 Finding ALL Facebook Messages in Database...\n');
    
    // 1. Get all Facebook messages
    const allFbMessages = await prisma.chatMessage.findMany({
      where: { platform: 'FACEBOOK' },
      include: {
        conversation: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    console.log(`📊 Total Facebook Messages: ${allFbMessages.length}`);
    
    if (allFbMessages.length === 0) {
      console.log('❌ No Facebook messages found in database');
      return;
    }
    
    // 2. Group by account ID
    const byAccount = {};
    allFbMessages.forEach(msg => {
      if (!byAccount[msg.accountId]) {
        byAccount[msg.accountId] = [];
      }
      byAccount[msg.accountId].push(msg);
    });
    
    console.log('\n📱 Messages by Account ID:');
    Object.keys(byAccount).forEach(accountId => {
      console.log(`\n   Account: ${accountId} (${byAccount[accountId].length} messages)`);
      byAccount[accountId].slice(0, 3).forEach((msg, i) => {
        console.log(`     ${i+1}. ${msg.senderName}: "${msg.content.substring(0, 50)}..."`);
        console.log(`        Timestamp: ${msg.timestamp}`);
      });
    });
    
    // 3. Check social accounts
    console.log('\n🔗 Social Accounts Check:');
    const uniqueAccountIds = [...new Set(allFbMessages.map(msg => msg.accountId))];
    
    for (const accountId of uniqueAccountIds) {
      const socialAccount = await prisma.socialAccount.findFirst({
        where: { accountId: accountId },
        include: { business: true }
      });
      
      if (socialAccount) {
        console.log(`   ✅ ${accountId} → ${socialAccount.business?.name} (${socialAccount.platform})`);
      } else {
        console.log(`   ❌ ${accountId} → No social account found!`);
      }
    }
    
    // 4. Check for conversations
    console.log('\n💬 Conversations Check:');
    const conversations = await prisma.conversation.findMany({
      where: { platform: 'FACEBOOK' },
      include: { messages: true }
    });
    
    console.log(`   Total Facebook conversations: ${conversations.length}`);
    conversations.forEach((conv, i) => {
      console.log(`   ${i+1}. ${conv.id} (${conv.messages.length} messages)`);
      console.log(`      Account: ${conv.accountId}`);
      console.log(`      Participants: ${conv.participantNames.join(', ')}`);
    });
    
    // 5. Find the specific messages from our earlier search
    console.log('\n🎯 Messages from Earlier Search:');
    const johnDoeMessages = allFbMessages.filter(msg => 
      msg.senderName === 'John Doe' && 
      msg.content.includes('Hello, I need help with pricing')
    );
    
    if (johnDoeMessages.length > 0) {
      console.log(`   Found ${johnDoeMessages.length} John Doe messages`);
      johnDoeMessages.forEach((msg, i) => {
        console.log(`   ${i+1}. Account: ${msg.accountId}`);
        console.log(`      Content: "${msg.content.substring(0, 60)}..."`);
        console.log(`      Timestamp: ${msg.timestamp}`);
        console.log(`      Conversation ID: ${msg.conversationId || 'None'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error finding messages:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the search
if (require.main === module) {
  findAllFacebookMessages();
}

module.exports = { findAllFacebookMessages };
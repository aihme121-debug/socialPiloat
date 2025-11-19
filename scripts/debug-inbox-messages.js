#!/usr/bin/env node

/**
 * Debug SaaS Inbox Message Flow
 * Check why stored Facebook messages aren't showing in the Inbox
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugInboxMessages() {
  try {
    console.log('🔍 Debugging SaaS Inbox Message Flow...\n');
    
    // 1. Check stored Facebook messages
    console.log('📚 STORED FACEBOOK MESSAGES:');
    const storedMessages = await prisma.chatMessage.findMany({
      where: { 
        platform: 'FACEBOOK',
        businessId: 'clp6m2z3l0000qsac5g5g5g5g' // Canva Hme business ID
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        conversation: true,
        customer: true
      }
    });
    
    if (storedMessages.length === 0) {
      console.log('❌ No stored Facebook messages found');
    } else {
      console.log(`✅ Found ${storedMessages.length} stored Facebook messages:`);
      storedMessages.forEach((msg, i) => {
        console.log(`  ${i+1}. ${msg.senderName}: "${msg.content.substring(0, 60)}..."`);
        console.log(`     Conversation: ${msg.conversationId || 'No conversation'}`);
        console.log(`     Customer: ${msg.customer?.name || 'No customer'}`);
        console.log(`     Timestamp: ${msg.timestamp}`);
        console.log('');
      });
    }
    
    // 2. Check conversations
    console.log('💬 CONVERSATIONS:');
    const conversations = await prisma.conversation.findMany({
      where: { 
        platform: 'FACEBOOK',
        businessId: 'clp6m2z3l0000qsac5g5g5g5g'
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (conversations.length === 0) {
      console.log('❌ No Facebook conversations found');
    } else {
      console.log(`✅ Found ${conversations.length} Facebook conversations:`);
      conversations.forEach((conv, i) => {
        console.log(`  ${i+1}. ID: ${conv.id}`);
        console.log(`     Participants: ${conv.participantNames.join(', ')}`);
        console.log(`     Status: ${conv.isActive ? 'Active' : 'Inactive'}`);
        console.log(`     Last Message: ${conv.messages[0]?.content?.substring(0, 50) || 'No messages'}`);
        console.log(`     Updated: ${conv.updatedAt}`);
        console.log('');
      });
    }
    
    // 3. Check social account mapping
    console.log('🔗 SOCIAL ACCOUNT MAPPING:');
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { 
        platform: 'FACEBOOK',
        businessId: 'clp6m2z3l0000qsac5g5g5g5g',
        isActive: true
      }
    });
    
    if (!socialAccount) {
      console.log('❌ No active Facebook social account found');
    } else {
      console.log(`✅ Found Facebook social account:`);
      console.log(`   Account ID: ${socialAccount.accountId}`);
      console.log(`   Platform ID: ${socialAccount.platformId}`);
      console.log(`   Has Access Token: ${socialAccount.accessToken ? '✅ YES' : '❌ NO'}`);
      console.log(`   Settings: ${JSON.stringify(socialAccount.settings, null, 2)}`);
    }
    
    // 4. Check for conversation ID mismatches
    console.log('⚠️ POTENTIAL ISSUES:');
    
    // Messages without conversations
    const orphanedMessages = await prisma.chatMessage.findMany({
      where: { 
        platform: 'FACEBOOK',
        conversationId: null,
        businessId: 'clp6m2z3l0000qsac5g5g5g5g'
      },
      take: 5
    });
    
    if (orphanedMessages.length > 0) {
      console.log(`⚠️  Found ${orphanedMessages.length} messages without conversations`);
      console.log('   These messages won\'t show in Inbox because they lack conversation mapping');
    }
    
    // Check conversation ID format
    if (conversations.length > 0 && storedMessages.length > 0) {
      const conversationIds = conversations.map(c => c.id);
      const messageConversationIds = storedMessages.map(m => m.conversationId).filter(Boolean);
      
      const mismatchedIds = messageConversationIds.filter(id => !conversationIds.includes(id));
      if (mismatchedIds.length > 0) {
        console.log(`⚠️  Found ${mismatchedIds.length} messages with mismatched conversation IDs`);
        console.log('   Message conversation IDs:', [...new Set(mismatchedIds)]);
        console.log('   Available conversation IDs:', conversationIds);
      }
    }
    
    // 5. Suggest fixes
    console.log('\n🔧 RECOMMENDATIONS:');
    
    if (orphanedMessages.length > 0) {
      console.log('1. Create conversations for orphaned messages');
      console.log('2. Update message conversationId references');
    }
    
    if (conversations.length === 0 && storedMessages.length > 0) {
      console.log('1. Create conversations from stored messages');
      console.log('2. Ensure webhook creates conversations properly');
    }
    
    if (conversations.length > 0 && storedMessages.length > 0) {
      console.log('✅ Messages and conversations exist - check Inbox API endpoints');
    }
    
  } catch (error) {
    console.error('❌ Error debugging Inbox messages:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the debug
if (require.main === module) {
  debugInboxMessages();
}

module.exports = { debugInboxMessages };
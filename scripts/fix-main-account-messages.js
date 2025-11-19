#!/usr/bin/env node

/**
 * Fix Facebook Messages for Main Account
 * Process messages for account ID 832877782728202
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixMainAccountMessages() {
  try {
    console.log('🔧 Fixing Facebook Messages for Main Account...\n');
    
    // Target the specific account ID from your terminal output
    const accountId = '832877782728202';
    
    // Find all Facebook messages for this account
    const allMessages = await prisma.chatMessage.findMany({
      where: {
        platform: 'FACEBOOK',
        accountId: accountId
      },
      orderBy: { timestamp: 'asc' }
    });
    
    console.log(`📨 Found ${allMessages.length} Facebook messages for account ${accountId}`);
    
    if (allMessages.length === 0) {
      console.log('❌ No messages found for this account');
      return;
    }
    
    // Show first few messages
    console.log('\n📋 Sample Messages:');
    allMessages.slice(0, 3).forEach((msg, i) => {
      console.log(`   ${i+1}. ${msg.senderName}: "${msg.content.substring(0, 50)}..."`);
      console.log(`      Timestamp: ${msg.timestamp}`);
      console.log(`      Conversation ID: ${msg.conversationId || 'None'}`);
      console.log('');
    });
    
    // Group messages by sender and create conversations
    const conversationsBySender = {};
    
    for (const message of allMessages) {
      const senderKey = message.senderId;
      
      if (!conversationsBySender[senderKey]) {
        conversationsBySender[senderKey] = {
          senderId: senderKey,
          senderName: message.senderName,
          messages: [],
          firstMessage: message,
          lastMessage: message
        };
      }
      
      conversationsBySender[senderKey].messages.push(message);
      
      if (message.timestamp < conversationsBySender[senderKey].firstMessage.timestamp) {
        conversationsBySender[senderKey].firstMessage = message;
      }
      
      if (message.timestamp > conversationsBySender[senderKey].lastMessage.timestamp) {
        conversationsBySender[senderKey].lastMessage = message;
      }
    }
    
    console.log(`\n👥 Found ${Object.keys(conversationsBySender).length} unique senders`);
    
    // Find the business for this account
    const socialAccount = await prisma.socialAccount.findFirst({
      where: { accountId: accountId },
      include: { business: true }
    });
    
    if (!socialAccount) {
      console.log('❌ No social account found for this account ID');
      return;
    }
    
    console.log(`🏢 Business: ${socialAccount.business?.name}`);
    
    // Create conversations and link messages
    for (const senderKey of Object.keys(conversationsBySender)) {
      const conversationData = conversationsBySender[senderKey];
      
      console.log(`\n💬 Creating conversation for ${conversationData.senderName} (${conversationData.messages.length} messages)`);
      
      // Check if conversation already exists
      let conversation = await prisma.conversation.findFirst({
        where: {
          platform: 'FACEBOOK',
          accountId: accountId,
          businessId: socialAccount.businessId,
          participantIds: { has: senderKey }
        }
      });
      
      if (conversation) {
        console.log(`   ✓ Conversation already exists: ${conversation.id}`);
      } else {
        // Create new conversation
        conversation = await prisma.conversation.create({
          data: {
            platform: 'FACEBOOK',
            accountId: accountId,
            businessId: socialAccount.businessId,
            participantIds: [senderKey],
            participantNames: [conversationData.senderName],
            lastMessageAt: conversationData.lastMessage.timestamp,
            unreadCount: conversationData.messages.filter(m => !m.isRead).length,
            isActive: true
          }
        });
        
        console.log(`   ✓ Created conversation: ${conversation.id}`);
      }
      
      // Link messages to conversation
      const unlinkedMessages = conversationData.messages.filter(m => !m.conversationId);
      if (unlinkedMessages.length > 0) {
        const messageIds = unlinkedMessages.map(m => m.id);
        await prisma.chatMessage.updateMany({
          where: {
            id: { in: messageIds }
          },
          data: {
            conversationId: conversation.id
          }
        });
        
        console.log(`   ✓ Linked ${messageIds.length} messages to conversation`);
      }
    }
    
    console.log('\n🎉 Main account conversation fix complete!');
    
    // Show final results
    const finalConversations = await prisma.conversation.findMany({
      where: { 
        platform: 'FACEBOOK',
        accountId: accountId
      },
      include: {
        messages: true,
        business: true
      }
    });
    
    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`✅ Total conversations for account ${accountId}: ${finalConversations.length}`);
    
    finalConversations.forEach((conv, i) => {
      console.log(`   ${i+1}. ${conv.business?.name} - ${conv.participantNames[0]} (${conv.messages.length} messages)`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing main account messages:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
if (require.main === module) {
  fixMainAccountMessages();
}

module.exports = { fixMainAccountMessages };
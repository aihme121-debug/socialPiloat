#!/usr/bin/env node

/**
 * Fix Facebook Message Data - Create Conversations from Stored Messages
 * This will organize your stored Facebook messages into proper conversations
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixFacebookConversations() {
  try {
    console.log('🔧 Fixing Facebook Conversations and Messages...\n');
    
    // 1. Find all Facebook social accounts
    const fbAccounts = await prisma.socialAccount.findMany({
      where: { 
        platform: 'FACEBOOK',
        isActive: true
      },
      include: {
        business: true
      }
    });
    
    console.log(`📱 Found ${fbAccounts.length} active Facebook accounts`);
    
    for (const account of fbAccounts) {
      console.log(`\n🔄 Processing account: ${account.accountId} (${account.business?.name})`);
      
      // 2. Find all orphaned Facebook messages for this account
      const orphanedMessages = await prisma.chatMessage.findMany({
        where: {
          platform: 'FACEBOOK',
          accountId: account.accountId,
          conversationId: null
        },
        orderBy: { timestamp: 'asc' }
      });
      
      console.log(`   Found ${orphanedMessages.length} orphaned messages`);
      
      if (orphanedMessages.length === 0) continue;
      
      // 3. Group messages by sender (create conversations)
      const conversationsBySender = {};
      
      for (const message of orphanedMessages) {
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
      
      // 4. Create conversations and link messages
      for (const senderKey of Object.keys(conversationsBySender)) {
        const conversationData = conversationsBySender[senderKey];
        
        console.log(`   Creating conversation for ${conversationData.senderName} (${conversationData.messages.length} messages)`);
        
        // Create conversation
        const conversation = await prisma.conversation.create({
          data: {
            platform: 'FACEBOOK',
            accountId: account.accountId,
            businessId: account.businessId,
            participantIds: [conversationData.senderId],
            participantNames: [conversationData.senderName],
            lastMessageAt: conversationData.lastMessage.timestamp,
            unreadCount: conversationData.messages.filter(m => !m.isRead).length,
            isActive: true
          }
        });
        
        console.log(`   ✓ Created conversation: ${conversation.id}`);
        
        // Link messages to conversation
        const messageIds = conversationData.messages.map(m => m.id);
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
    
    console.log('\n🎉 Facebook conversation fix complete!');
    
    // 5. Show final results
    console.log('\n📊 FINAL RESULTS:');
    
    const finalConversations = await prisma.conversation.findMany({
      where: { platform: 'FACEBOOK' },
      include: {
        messages: true,
        business: true
      }
    });
    
    console.log(`✅ Total Facebook conversations: ${finalConversations.length}`);
    
    finalConversations.forEach((conv, i) => {
      console.log(`   ${i+1}. ${conv.business?.name} - ${conv.participantNames[0]} (${conv.messages.length} messages)`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing Facebook conversations:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
if (require.main === module) {
  fixFacebookConversations();
}

module.exports = { fixFacebookConversations };
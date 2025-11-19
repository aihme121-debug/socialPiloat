#!/usr/bin/env node

/**
 * Find Correct Business and Debug Message Flow
 * Identifies the actual business and message data
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findBusinessData() {
  try {
    console.log('🔍 Finding Business and Message Data...\n');
    
    // 1. Find all businesses and their Facebook accounts
    const businesses = await prisma.business.findMany({
      include: {
        users: {
          select: { email: true, name: true }
        },
        socialAccounts: {
          where: { platform: 'FACEBOOK' }
        }
      }
    });
    
    console.log('🏢 BUSINESSES WITH FACEBOOK ACCOUNTS:');
    businesses.forEach((business, i) => {
      console.log(`${i+1}. ${business.name} (ID: ${business.id})`);
      console.log(`   Users: ${business.users.map(u => u.email).join(', ')}`);
      console.log(`   Facebook Accounts: ${business.socialAccounts.length}`);
      business.socialAccounts.forEach(acc => {
        console.log(`     - ${acc.accountId} (${acc.isActive ? 'Active' : 'Inactive'})`);
      });
      console.log('');
    });
    
    // 2. Find all Facebook messages across all businesses
    console.log('📨 ALL FACEBOOK MESSAGES:');
    const allFbMessages = await prisma.chatMessage.findMany({
      where: { platform: 'FACEBOOK' },
      include: {
        conversation: {
          include: {
            business: true
          }
        },
        customer: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    if (allFbMessages.length === 0) {
      console.log('❌ No Facebook messages found in database');
    } else {
      console.log(`✅ Found ${allFbMessages.length} Facebook messages:`);
      allFbMessages.forEach((msg, i) => {
        console.log(`  ${i+1}. Business: ${msg.conversation?.business?.name || 'Unknown'}`);
        console.log(`     Sender: ${msg.senderName}`);
        console.log(`     Content: "${msg.content.substring(0, 60)}..."`);
        console.log(`     Conversation ID: ${msg.conversationId || 'No conversation'}`);
        console.log(`     Timestamp: ${msg.timestamp}`);
        console.log('');
      });
    }
    
    // 3. Find all conversations
    console.log('💬 ALL CONVERSATIONS:');
    const allConversations = await prisma.conversation.findMany({
      where: { platform: 'FACEBOOK' },
      include: {
        business: true,
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (allConversations.length === 0) {
      console.log('❌ No Facebook conversations found');
    } else {
      console.log(`✅ Found ${allConversations.length} Facebook conversations:`);
      allConversations.forEach((conv, i) => {
        console.log(`  ${i+1}. ID: ${conv.id}`);
        console.log(`     Business: ${conv.business?.name || 'Unknown'}`);
        console.log(`     Participants: ${conv.participantNames.join(', ')}`);
        console.log(`     Account ID: ${conv.accountId}`);
        console.log(`     Messages: ${conv.messages.length}`);
        console.log(`     Updated: ${conv.updatedAt}`);
        console.log('');
      });
    }
    
    // 4. Check social accounts
    console.log('📱 FACEBOOK SOCIAL ACCOUNTS:');
    const fbAccounts = await prisma.socialAccount.findMany({
      where: { platform: 'FACEBOOK' },
      include: {
        business: true
      }
    });
    
    if (fbAccounts.length === 0) {
      console.log('❌ No Facebook social accounts found');
    } else {
      console.log(`✅ Found ${fbAccounts.length} Facebook social accounts:`);
      fbAccounts.forEach((acc, i) => {
        console.log(`  ${i+1}. Business: ${acc.business?.name || 'Unknown'}`);
        console.log(`     Account ID: ${acc.accountId}`);
        console.log(`     Platform ID: ${acc.platformId}`);
        console.log(`     Status: ${acc.isActive ? 'Active' : 'Inactive'}`);
        console.log(`     Has Token: ${acc.accessToken ? '✅ YES' : '❌ NO'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error finding business data:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the finder
if (require.main === module) {
  findBusinessData();
}

module.exports = { findBusinessData };
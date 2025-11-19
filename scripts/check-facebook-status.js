#!/usr/bin/env node

/**
 * Check Facebook Account Connection Status
 * Helps verify current Facebook integration status
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkFacebookAccounts() {
  try {
    console.log('🔍 Checking Facebook Account Status...\n');
    
    // Check all social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { platform: 'FACEBOOK' },
      include: {
        business: {
          include: {
            users: {
              select: { email: true, name: true }
            }
          }
        }
      }
    });
    
    if (socialAccounts.length === 0) {
      console.log('❌ No Facebook accounts found in database.');
      console.log('💡 You need to connect a Facebook account first.');
      return;
    }
    
    console.log(`📊 Found ${socialAccounts.length} Facebook account(s):\n`);
    
    socialAccounts.forEach((account, index) => {
      console.log(`Account #${index + 1}:`);
      console.log(`  📱 Account ID: ${account.accountId}`);
      console.log(`  🏢 Business: ${account.business?.name || 'No business'}`);
      console.log(`  👥 Users: ${account.business?.users.map(u => u.email).join(', ') || 'No users'}`);
      console.log(`  🔑 Has Access Token: ${account.accessToken ? '✅ YES' : '❌ NO'}`);
      console.log(`  📅 Created: ${account.createdAt}`);
      console.log(`  🔄 Last Updated: ${account.updatedAt}`);
      console.log(`  📈 Status: ${account.isActive ? '✅ Active' : '❌ Inactive'}`);
      
      if (account.settings) {
        const settings = typeof account.settings === 'string' ? JSON.parse(account.settings) : account.settings;
        const pages = settings.pages || [];
        console.log(`  📄 Connected Pages: ${pages.length}`);
        pages.forEach(page => {
          console.log(`    - ${page.name} (ID: ${page.id})`);
        });
      }
      
      console.log('');
    });
    
    // Check for any recent webhook activity
    console.log('📡 Recent Webhook Activity Check:');
    const recentMessages = await prisma.chatMessage.findMany({
      where: { 
        platform: 'FACEBOOK',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    if (recentMessages.length > 0) {
      console.log(`✅ Found ${recentMessages.length} Facebook messages in last 24h`);
      recentMessages.forEach(msg => {
        console.log(`  - ${msg.senderName}: "${msg.content.substring(0, 50)}..." (${msg.createdAt})`);
      });
    } else {
      console.log('⚠️ No Facebook messages found in last 24 hours');
    }
    
  } catch (error) {
    console.error('❌ Error checking Facebook accounts:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
if (require.main === module) {
  checkFacebookAccounts();
}

module.exports = { checkFacebookAccounts };
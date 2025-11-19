const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFacebookAccounts() {
  try {
    console.log('🔍 Checking Facebook accounts in database...');
    
    // Check all social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { platform: 'FACEBOOK' },
      include: { business: true }
    });
    
    console.log('📊 Found', socialAccounts.length, 'Facebook accounts:');
    
    socialAccounts.forEach((account, index) => {
      console.log(`\n--- Account ${index + 1} ---`);
      console.log('ID:', account.id);
      console.log('Account ID:', account.accountId);
      console.log('Account Name:', account.accountName);
      console.log('Platform:', account.platform);
      console.log('Is Active:', account.isActive);
      console.log('Connected At:', account.connectedAt);
      console.log('Expires At:', account.expiresAt);
      console.log('Has Access Token:', !!account.accessToken);
      console.log('Business ID:', account.businessId);
      console.log('Business Name:', account.business?.name || 'N/A');
      
      // Check settings structure
      if (account.settings) {
        console.log('Settings Available:', typeof account.settings);
        if (typeof account.settings === 'object') {
          console.log('Profile Data:', !!account.settings.profile);
          console.log('Pages Data:', !!account.settings.pages);
          if (account.settings.pages) {
            console.log('Pages Count:', Array.isArray(account.settings.pages) ? account.settings.pages.length : 'N/A');
          }
        }
      }
    });
    
    // Check recent messages
    console.log('\n🔍 Checking recent Facebook messages...');
    const recentMessages = await prisma.chatMessage.findMany({
      where: { platform: 'FACEBOOK' },
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    
    console.log('Recent Messages:', recentMessages.length);
    recentMessages.forEach((msg, index) => {
      console.log(`Message ${index + 1}:`, {
        id: msg.id,
        sender: msg.senderName,
        content: msg.content.substring(0, 50) + '...',
        timestamp: msg.timestamp
      });
    });
    
    // Check conversations
    console.log('\n🔍 Checking Facebook conversations...');
    const conversations = await prisma.conversation.findMany({
      where: { platform: 'FACEBOOK' },
      include: { messages: { take: 1, orderBy: { timestamp: 'desc' } } }
    });
    
    console.log('Conversations:', conversations.length);
    conversations.forEach((conv, index) => {
      console.log(`Conversation ${index + 1}:`, {
        id: conv.id,
        participants: conv.participantNames,
        unreadCount: conv.unreadCount,
        isActive: conv.isActive,
        lastMessage: conv.messages[0]?.content?.substring(0, 30) + '...'
      });
    });
    
  } catch (error) {
    console.error('Error checking database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkFacebookAccounts();
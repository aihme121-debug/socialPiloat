const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFacebookConnection() {
  try {
    console.log('🔧 Fixing Facebook connection issues...');
    
    // Get the Facebook account
    const account = await prisma.socialAccount.findFirst({
      where: { platform: 'FACEBOOK' }
    });
    
    if (!account) {
      console.log('❌ No Facebook account found');
      return;
    }
    
    console.log('📋 Current Account:', account.accountName);
    
    // 1. Fix token expiration
    if (!account.expiresAt) {
      console.log('🔄 Setting token expiration...');
      // Set expiration to 60 days from now (Facebook tokens typically last 60 days)
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { expiresAt }
      });
      
      console.log('✅ Token expiration set to:', expiresAt.toISOString());
    }
    
    // 2. Create conversations from existing messages
    console.log('📝 Creating conversations from messages...');
    
    const facebookMessages = await prisma.chatMessage.findMany({
      where: { 
        platform: 'FACEBOOK',
        accountId: account.id
      },
      orderBy: { timestamp: 'desc' }
    });
    
    console.log('Found', facebookMessages.length, 'messages');
    
    // Group messages by sender
    const senderGroups = {};
    facebookMessages.forEach(msg => {
      if (!senderGroups[msg.senderId]) {
        senderGroups[msg.senderId] = {
          senderId: msg.senderId,
          senderName: msg.senderName,
          messages: [],
          lastMessage: null
        };
      }
      senderGroups[msg.senderId].messages.push(msg);
      if (!senderGroups[msg.senderId].lastMessage || msg.timestamp > senderGroups[msg.senderId].lastMessage.timestamp) {
        senderGroups[msg.senderId].lastMessage = msg;
      }
    });
    
    // Create conversations for each sender
    for (const senderId in senderGroups) {
      const group = senderGroups[senderId];
      
      // Check if conversation already exists
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          platform: 'FACEBOOK',
          accountId: account.accountId,
          participantIds: { has: senderId }
        }
      });
      
      if (!existingConversation) {
        console.log('Creating conversation for sender:', senderId);
        
        await prisma.conversation.create({
          data: {
            platform: 'FACEBOOK',
            accountId: account.accountId,
            businessId: account.businessId,
            participantIds: [senderId, account.accountId],
            participantNames: [group.senderName, account.accountName],
            lastMessageAt: group.lastMessage.timestamp,
            unreadCount: group.messages.filter(m => !m.isRead).length,
            isActive: true
          }
        });
        
        console.log('✅ Conversation created for:', group.senderName);
      } else {
        console.log('Conversation already exists for:', group.senderName);
      }
    }
    
    // 3. Update message conversation IDs
    console.log('🔗 Linking messages to conversations...');
    
    for (const senderId in senderGroups) {
      const group = senderGroups[senderId];
      
      const conversation = await prisma.conversation.findFirst({
        where: {
          platform: 'FACEBOOK',
          accountId: account.accountId,
          participantIds: { has: senderId }
        }
      });
      
      if (conversation) {
        // Update all messages from this sender
        await prisma.chatMessage.updateMany({
          where: {
            platform: 'FACEBOOK',
            senderId: senderId,
            conversationId: null
          },
          data: { conversationId: conversation.id }
        });
        
        console.log('✅ Updated', group.messages.length, 'messages for sender:', senderId);
      }
    }
    
    // 4. Test webhook connectivity
    console.log('📡 Testing webhook setup...');
    
    // Get page access token from settings
    const settings = account.settings;
    let pageAccessToken = null;
    
    if (settings && settings.pages && Array.isArray(settings.pages) && settings.pages.length > 0) {
      pageAccessToken = settings.pages[0].access_token;
      console.log('Found page access token for:', settings.pages[0].name);
    }
    
    if (pageAccessToken) {
      // Test page subscription
      try {
        const response = await fetch(`https://graph.facebook.com/${settings.pages[0].id}/subscribed_apps?access_token=${pageAccessToken}`);
        const data = await response.json();
        
        if (response.ok) {
          console.log('✅ Page subscription status:', data.data ? 'Subscribed' : 'Not subscribed');
          
          if (!data.data || data.data.length === 0) {
            console.log('📢 Page needs webhook subscription setup');
          }
        } else {
          console.log('❌ Page subscription check failed:', data.error);
        }
      } catch (error) {
        console.log('❌ Error checking page subscription:', error.message);
      }
    }
    
    console.log('\n🎉 Facebook connection fixes completed!');
    
    // Show final status
    const updatedAccount = await prisma.socialAccount.findFirst({
      where: { id: account.id },
      include: {
        business: true,
        _count: {
          select: {
            messages: true
          }
        }
      }
    });
    
    const conversations = await prisma.conversation.findMany({
      where: {
        platform: 'FACEBOOK',
        accountId: account.accountId
      }
    });
    
    console.log('\n📊 Final Status:');
    console.log('Account Name:', updatedAccount.accountName);
    console.log('Messages:', updatedAccount._count.messages);
    console.log('Conversations:', conversations.length);
    console.log('Expires At:', updatedAccount.expiresAt);
    console.log('Is Active:', updatedAccount.isActive);
    
  } catch (error) {
    console.error('Error fixing Facebook connection:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixFacebookConnection();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Check Facebook messages for acc_123
    const messages = await prisma.chatMessage.findMany({
      where: { 
        platform: 'FACEBOOK', 
        accountId: 'acc_123' 
      },
      take: 5
    });
    
    console.log(`Found ${messages.length} Facebook messages for acc_123`);
    messages.forEach(msg => {
      console.log(`Message: ${msg.messageId} - ${msg.content?.substring(0, 50)}...`);
    });
    
    // Check all Facebook messages
    const allMessages = await prisma.chatMessage.findMany({
      where: { platform: 'FACEBOOK' },
      take: 10
    });
    
    console.log(`Found ${allMessages.length} total Facebook messages`);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
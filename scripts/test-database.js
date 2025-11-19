const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Check Facebook messages
    const messages = await prisma.message.findMany({
      where: { platform: 'FACEBOOK' },
      take: 5
    });
    
    console.log(`Found ${messages.length} Facebook messages`);
    messages.forEach(msg => {
      console.log(`Message: ${msg.messageId} - ${msg.content?.substring(0, 50)}...`);
    });
    
    // Check conversations
    const conversations = await prisma.conversation.findMany({
      where: { platform: 'FACEBOOK' },
      take: 5
    });
    
    console.log(`Found ${conversations.length} Facebook conversations`);
    conversations.forEach(conv => {
      console.log(`Conversation: ${conv.id} - ${conv.participantNames?.join(', ')}`);
    });
    
    // Check social accounts
    const accounts = await prisma.socialAccount.findMany({
      where: { platform: 'FACEBOOK' },
      take: 5
    });
    
    console.log(`Found ${accounts.length} Facebook social accounts`);
    accounts.forEach(account => {
      console.log(`Account: ${account.accountId} - ${account.name}`);
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
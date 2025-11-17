const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSocialAccounts() {
  try {
    // Get the first user to check their business
    const user = await prisma.user.findFirst({
      include: { business: true }
    });

    if (!user) {
      console.log('No users found');
      return;
    }

    console.log('User:', user.email);
    console.log('Business:', user.business?.name || 'No business');

    if (user.business) {
      // Check social accounts for this business
      const socialAccounts = await prisma.socialAccount.findMany({
        where: { businessId: user.business.id }
      });

      console.log('Social Accounts:', socialAccounts.length);
      socialAccounts.forEach(account => {
        console.log(`- ${account.platform}: ${account.accountName} (${account.accountId})`);
        console.log(`  Active: ${account.isActive}`);
        console.log(`  Settings:`, account.settings);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSocialAccounts();
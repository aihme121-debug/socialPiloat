const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccounts() {
  try {
    console.log('Checking social accounts...');
    
    const accounts = await prisma.socialAccount.findMany({
      include: { 
        business: { 
          include: { users: true } 
        } 
      }
    });
    
    console.log('Total social accounts:', accounts.length);
    
    accounts.forEach((account, index) => {
      console.log(`\nAccount ${index + 1}:`);
      console.log('  ID:', account.id);
      console.log('  Platform:', account.platform);
      console.log('  Account ID:', account.accountId);
      console.log('  Account Name:', account.accountName);
      console.log('  Business ID:', account.businessId);
      console.log('  Is Active:', account.isActive);
      console.log('  Connected At:', account.connectedAt);
      console.log('  Business Users:', account.business?.users?.map(u => u.email).join(', ') || 'No users');
    });
    
    // Check users and their businesses
    console.log('\n--- Users and Businesses ---');
    const users = await prisma.user.findMany({
      include: { business: true }
    });
    
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log('  Email:', user.email);
      console.log('  User ID:', user.id);
      console.log('  Business ID:', user.businessId);
      console.log('  Business Name:', user.business?.name || 'No business');
    });
    
  } catch (error) {
    console.error('Error checking accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccounts();
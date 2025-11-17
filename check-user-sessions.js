const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserSessions() {
  try {
    console.log('=== USER SESSION ANALYSIS ===\n');
    
    // Check all users and their businesses
    const users = await prisma.user.findMany({
      include: { 
        business: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('Available Users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Business ID: ${user.businessId || 'NONE'}`);
      console.log(`   Business Name: ${user.business?.name || 'No Business'}`);
      console.log(`   Last Login: ${user.lastLogin || 'Never'}`);
      console.log('');
    });
    
    // Check social accounts and their business associations
    console.log('\n=== SOCIAL ACCOUNTS ANALYSIS ===\n');
    
    const socialAccounts = await prisma.socialAccount.findMany({
      include: { 
        business: { 
          include: { users: true } 
        } 
      },
      orderBy: { connectedAt: 'desc' }
    });
    
    console.log('Social Accounts:');
    socialAccounts.forEach((account, index) => {
      console.log(`${index + 1}. Platform: ${account.platform}`);
      console.log(`   Account ID: ${account.accountId}`);
      console.log(`   Account Name: ${account.accountName}`);
      console.log(`   Business ID: ${account.businessId}`);
      console.log(`   Business Name: ${account.business?.name || 'Unknown'}`);
      console.log(`   Connected Users: ${account.business?.users?.map(u => u.email).join(', ') || 'None'}`);
      console.log(`   Connected At: ${account.connectedAt}`);
      console.log(`   Is Active: ${account.isActive}`);
      console.log('');
    });
    
    // Summary
    console.log('\n=== SUMMARY ===\n');
    console.log(`Total Users: ${users.length}`);
    console.log(`Users with Business: ${users.filter(u => u.businessId).length}`);
    console.log(`Total Social Accounts: ${socialAccounts.length}`);
    console.log(`Active Social Accounts: ${socialAccounts.filter(a => a.isActive).length}`);
    
    // Find potential issues
    const usersWithoutBusiness = users.filter(u => !u.businessId);
    if (usersWithoutBusiness.length > 0) {
      console.log('\n⚠️  USERS WITHOUT BUSINESS (Cannot connect social accounts):');
      usersWithoutBusiness.forEach(user => {
        console.log(`   - ${user.email}`);
      });
    }
    
    const orphanedAccounts = socialAccounts.filter(a => !a.business);
    if (orphanedAccounts.length > 0) {
      console.log('\n⚠️  SOCIAL ACCOUNTS WITHOUT VALID BUSINESS:');
      orphanedAccounts.forEach(account => {
        console.log(`   - ${account.platform} account ${account.accountId} (Business ID: ${account.businessId})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking user sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserSessions();
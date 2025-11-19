const { PrismaClient } = require('@prisma/client');

async function debugFacebookData() {
  console.log('🔍 Debugging Facebook data structure...');
  
  const prisma = new PrismaClient();
  
  try {
    console.log('📡 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected');

    // Get all social accounts
    console.log('🔍 Looking for all social accounts...');
    const allSocialAccounts = await prisma.socialAccount.findMany({});
    console.log(`📱 Found ${allSocialAccounts.length} total social accounts`);
    
    allSocialAccounts.forEach((account, index) => {
      console.log(`   Account ${index + 1}:`);
      console.log(`     - Platform: ${account.platform}`);
      console.log(`     - Name: ${account.name}`);
      console.log(`     - Platform ID: ${account.platformId}`);
      console.log(`     - Access Token: ${account.accessToken ? '✅' : '❌'}`);
      console.log(`     - Connected: ${account.isActive}`);
      console.log(`     - Business ID: ${account.businessId}`);
      console.log('');
    });

    // Get Facebook accounts specifically
    console.log('🔍 Looking for Facebook accounts...');
    const facebookAccounts = await prisma.socialAccount.findMany({
      where: { 
        platform: 'FACEBOOK'
      }
    });

    console.log(`📱 Found ${facebookAccounts.length} Facebook accounts`);

    if (facebookAccounts.length === 0) {
      console.log('❌ No Facebook accounts found');
      return;
    }

    const facebookAccount = facebookAccounts[0];
    console.log('📱 Facebook account details:');
    console.log(`   - ID: ${facebookAccount.id}`);
    console.log(`   - Platform: ${facebookAccount.platform}`);
    console.log(`   - Name: ${facebookAccount.name}`);
    console.log(`   - Platform ID: ${facebookAccount.platformId}`);
    console.log(`   - Access Token: ${facebookAccount.accessToken ? '✅' : '❌'}`);
    console.log(`   - Connected: ${facebookAccount.isActive}`);
    console.log(`   - Business ID: ${facebookAccount.businessId}`);
    console.log(`   - Settings: ${JSON.stringify(facebookAccount.settings, null, 2)}`);

    // Check if there's a FacebookAccount table entry
    console.log('🔍 Checking FacebookAccount table...');
    const fbAccounts = await prisma.facebookAccount.findMany({});
    console.log(`📘 Found ${fbAccounts.length} FacebookAccount entries`);
    
    if (fbAccounts.length > 0) {
      console.log('📘 FacebookAccount details:');
      console.log(JSON.stringify(fbAccounts[0], null, 2));
    }

    // Check if there's a FacebookPage table entry
    console.log('🔍 Checking FacebookPage table...');
    const fbPages = await prisma.facebookPage.findMany({});
    console.log(`📄 Found ${fbPages.length} FacebookPage entries`);
    
    if (fbPages.length > 0) {
      console.log('📄 FacebookPage details:');
      console.log(JSON.stringify(fbPages[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error debugging Facebook data:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debugFacebookData();
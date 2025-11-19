const { PrismaClient } = require('@prisma/client');

async function checkWebhookSubscription() {
  console.log('🔍 Starting webhook subscription check...');
  
  const prisma = new PrismaClient();
  
  try {
    console.log('📡 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected');

    // Get the Facebook account
    console.log('🔍 Looking for Facebook accounts...');
    const facebookAccounts = await prisma.socialAccount.findMany({
      where: { 
        platform: 'FACEBOOK',
        isActive: true 
      }
    });

    console.log(`📱 Found ${facebookAccounts.length} Facebook accounts`);

    if (facebookAccounts.length === 0) {
      console.log('❌ No active Facebook account found');
      return;
    }

    const facebookAccount = facebookAccounts[0];
    console.log('📱 Found Facebook account:');
    console.log(`   - Name: ${facebookAccount.name}`);
    console.log(`   - Platform ID: ${facebookAccount.platformId}`);
    console.log(`   - Connected: ${facebookAccount.isActive}`);

    // Extract page data from settings
    const settings = facebookAccount.settings || {};
    const pages = settings.pages || [];
    
    if (pages.length === 0) {
      console.log('❌ No Facebook pages found in settings');
      return;
    }

    const page = pages[0];
    console.log('📄 Found Facebook page:');
    console.log(`   - Page Name: ${page.name}`);
    console.log(`   - Page ID: ${page.id}`);
    console.log(`   - Tasks: ${page.tasks.join(', ')}`);

    // Get app credentials from environment
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const pageAccessToken = page.access_token;
    
    if (!appId || !appSecret) {
      console.log('❌ Missing Facebook app credentials');
      console.log(`   App ID: ${appId ? '✅' : '❌'}`);
      console.log(`   App Secret: ${appSecret ? '✅' : '❌'}`);
      return;
    }

    if (!pageAccessToken) {
      console.log('❌ No page access token found');
      return;
    }

    console.log('🔑 Found credentials and page access token');

    // Check webhook subscriptions
    console.log('📡 Checking webhook subscriptions...');
    console.log(`   App ID: ${appId}`);
    console.log(`   Page ID: ${page.id}`);
    
    // Check if we have page webhook subscriptions
    console.log('📡 Making API call to check subscriptions...');
    const pageSubscriptionsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps?access_token=${pageAccessToken}`
    );

    console.log(`   Response status: ${pageSubscriptionsResponse.status}`);

    if (!pageSubscriptionsResponse.ok) {
      console.log('❌ Failed to get page subscriptions:', pageSubscriptionsResponse.status);
      const errorText = await pageSubscriptionsResponse.text();
      console.log('   Error details:', errorText);
      return;
    }

    const pageSubscriptions = await pageSubscriptionsResponse.json();
    console.log('📄 Page webhook subscriptions:');
    console.log(JSON.stringify(pageSubscriptions, null, 2));

    // Check specific fields subscription
    const fieldsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps?fields=fields&access_token=${pageAccessToken}`
    );

    if (fieldsResponse.ok) {
      const fieldsData = await fieldsResponse.json();
      console.log('🎯 Subscribed fields:');
      console.log(JSON.stringify(fieldsData, null, 2));
    }

    console.log('\n✅ Webhook subscription check completed');

  } catch (error) {
    console.error('❌ Error checking webhook subscription:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkWebhookSubscription();
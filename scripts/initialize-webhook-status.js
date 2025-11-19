const { PrismaClient } = require('@prisma/client');

/**
 * Initialize Facebook webhook status based on actual subscription status
 */
async function initializeFacebookWebhookStatus() {
  console.log('🔍 Initializing Facebook webhook status...');
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    // Get the Facebook account
    const facebookAccounts = await prisma.socialAccount.findMany({
      where: { 
        platform: 'FACEBOOK',
        isActive: true 
      }
    });

    if (facebookAccounts.length === 0) {
      console.log('❌ No Facebook account found');
      return false;
    }

    const facebookAccount = facebookAccounts[0];
    const settings = facebookAccount.settings || {};
    const pages = settings.pages || [];
    
    if (pages.length === 0) {
      console.log('❌ No Facebook pages found');
      return false;
    }

    const page = pages[0];
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const pageAccessToken = page.access_token;
    
    if (!appId || !appSecret || !pageAccessToken) {
      console.log('❌ Missing credentials');
      return false;
    }

    // Check webhook subscription status
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps?access_token=${pageAccessToken}`
    );

    if (!response.ok) {
      console.log('❌ Failed to check subscription');
      return false;
    }

    const data = await response.json();
    const isSubscribed = data.data && data.data.length > 0;
    
    console.log(`📡 Webhook subscription status: ${isSubscribed ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
    
    if (isSubscribed) {
      console.log('📊 Subscription details:');
      console.log(JSON.stringify(data.data[0], null, 2));
    }
    
    return isSubscribed;

  } catch (error) {
    console.error('❌ Error checking webhook status:', error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeFacebookWebhookStatus().then(isConnected => {
  console.log(`\n🎯 Final result: Facebook webhook is ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
  process.exit(isConnected ? 0 : 1);
});
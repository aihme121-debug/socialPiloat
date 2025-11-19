const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeFacebookAccount() {
  try {
    console.log('🔍 Analyzing Facebook account details...');
    
    // Get the Facebook account with full details
    const account = await prisma.socialAccount.findFirst({
      where: { platform: 'FACEBOOK' },
      include: { business: true }
    });
    
    if (!account) {
      console.log('❌ No Facebook account found');
      return;
    }
    
    console.log('\n📋 Facebook Account Analysis:');
    console.log('================================');
    console.log('Account ID:', account.id);
    console.log('Facebook Account ID:', account.accountId);
    console.log('Account Name:', account.accountName);
    console.log('Platform:', account.platform);
    console.log('Is Active:', account.isActive);
    console.log('Connected At:', account.connectedAt);
    console.log('Expires At:', account.expiresAt);
    console.log('Has Access Token:', !!account.accessToken);
    console.log('Business ID:', account.businessId);
    console.log('Business Name:', account.business?.name);
    
    // Check settings details
    if (account.settings && typeof account.settings === 'object') {
      console.log('\n📊 Settings Analysis:');
      console.log('Profile Data:', !!account.settings.profile);
      console.log('Pages Data:', !!account.settings.pages);
      
      if (account.settings.profile) {
        console.log('Profile Name:', account.settings.profile.name);
        console.log('Profile ID:', account.settings.profile.id);
      }
      
      if (account.settings.pages && Array.isArray(account.settings.pages)) {
        console.log('Pages Count:', account.settings.pages.length);
        account.settings.pages.forEach((page, index) => {
          console.log(`Page ${index + 1}:`, {
            id: page.id,
            name: page.name,
            category: page.category,
            hasAccessToken: !!page.access_token,
            tasks: page.tasks
          });
        });
      }
    }
    
    // Check token expiration
    if (account.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(account.expiresAt);
      const isExpired = now > expiresAt;
      console.log('\n⏰ Token Status:');
      console.log('Current Time:', now.toISOString());
      console.log('Expires At:', expiresAt.toISOString());
      console.log('Is Expired:', isExpired);
      if (isExpired) {
        console.log('⚠️  Token needs refresh!');
      } else {
        console.log('✅ Token is valid');
      }
    } else {
      console.log('\n⏰ Token Status: No expiration date set');
    }
    
    // Test API connectivity
    console.log('\n🧪 Testing Facebook API connectivity...');
    if (account.accessToken) {
      try {
        const response = await fetch(`https://graph.facebook.com/me?access_token=${account.accessToken}`);
        const data = await response.json();
        
        if (response.ok) {
          console.log('✅ Facebook API connection successful');
          console.log('API Response:', data);
        } else {
          console.log('❌ Facebook API error:', data.error);
          console.log('Error Code:', data.error?.code);
          console.log('Error Message:', data.error?.message);
        }
      } catch (error) {
        console.log('❌ Network error testing Facebook API:', error.message);
      }
    }
    
    // Check webhook status
    console.log('\n📡 Webhook Status Check:');
    const systemStatus = await fetch('http://localhost:7070/api/admin/system-status');
    if (systemStatus.ok) {
      const status = await systemStatus.json();
      console.log('System Status:', status.status.facebook);
    } else {
      console.log('❌ Could not fetch system status');
    }
    
  } catch (error) {
    console.error('Error analyzing Facebook account:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeFacebookAccount();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const SERVER_PORT = 7070;
const NGROK_API_PORT = 4040;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 3000; // 3 seconds

let restartCount = 0;
let isShuttingDown = false;
let ngrokProcess = null;
let serverProcess = null;

console.log('🚀 SocialPiloat AI - Development Server with Ngrok');
console.log('==============================================');

function logSystemEvent(level, message, details = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, details ? JSON.stringify(details) : '');
}

async function updateEnvironmentWithNgrok(publicUrl) {
  try {
    const envFile = path.join(__dirname, '.env.local');
    let envContent = '';
    
    // Read existing env file if it exists
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }
    
    // Update Facebook redirect URI
    const facebookRedirect = `${publicUrl}/api/auth/social/facebook/callback`;
    const facebookWebhook = `${publicUrl}/api/facebook/webhook`;
    
    // Replace existing ngrok URLs
    envContent = envContent.replace(/FACEBOOK_REDIRECT_URI=https:\/\/.*\.ngrok-free\.dev\/api\/facebook\/oauth\/callback/g, `FACEBOOK_REDIRECT_URI=${facebookRedirect}`);
    envContent = envContent.replace(/FACEBOOK_WEBHOOK_CALLBACK_URL=https:\/\/.*\.ngrok-free\.dev\/api\/facebook\/webhook/g, `FACEBOOK_WEBHOOK_CALLBACK_URL=${facebookWebhook}`);
    
    // Add other social media callback URLs
    const instagramRedirect = `${publicUrl}/api/auth/social/instagram/callback`;
    const twitterRedirect = `${publicUrl}/api/auth/social/twitter/callback`;
    const linkedinRedirect = `${publicUrl}/api/auth/social/linkedin/callback`;
    
    // Check if these lines exist, if not add them
    if (!envContent.includes('INSTAGRAM_REDIRECT_URI')) {
      envContent += `\nINSTAGRAM_REDIRECT_URI=${instagramRedirect}`;
    } else {
      envContent = envContent.replace(/INSTAGRAM_REDIRECT_URI=https:\/\/.*\.ngrok-free\.dev\/api\/auth\/social\/instagram\/callback/g, `INSTAGRAM_REDIRECT_URI=${instagramRedirect}`);
    }
    
    if (!envContent.includes('TWITTER_REDIRECT_URI')) {
      envContent += `\nTWITTER_REDIRECT_URI=${twitterRedirect}`;
    } else {
      envContent = envContent.replace(/TWITTER_REDIRECT_URI=https:\/\/.*\.ngrok-free\.dev\/api\/auth\/social\/twitter\/callback/g, `TWITTER_REDIRECT_URI=${twitterRedirect}`);
    }
    
    if (!envContent.includes('LINKEDIN_REDIRECT_URI')) {
      envContent += `\nLINKEDIN_REDIRECT_URI=${linkedinRedirect}`;
    } else {
      envContent = envContent.replace(/LINKEDIN_REDIRECT_URI=https:\/\/.*\.ngrok-free\.dev\/api\/auth\/social\/linkedin\/callback/g, `LINKEDIN_REDIRECT_URI=${linkedinRedirect}`);
    }
    
    // Update NEXTAUTH_URL for production
    if (!envContent.includes('NEXTAUTH_URL_PRODUCTION')) {
      envContent += `\nNEXTAUTH_URL_PRODUCTION=${publicUrl}`;
    } else {
      envContent = envContent.replace(/NEXTAUTH_URL_PRODUCTION=https:\/\/.*\.ngrok-free\.dev/g, `NEXTAUTH_URL_PRODUCTION=${publicUrl}`);
    }
    
    // Update NEXTAUTH_URL
    if (!envContent.includes('NEXTAUTH_URL')) {
      envContent += `\nNEXTAUTH_URL=${publicUrl}`;
    } else {
      envContent = envContent.replace(/NEXTAUTH_URL=https:\/\/.*\.ngrok-free\.dev/g, `NEXTAUTH_URL=${publicUrl}`);
    }
    
    fs.writeFileSync(envFile, envContent);
    
    console.log('📝 Updated environment file with ngrok URLs:');
    console.log(`  📘 Facebook Redirect: ${facebookRedirect}`);
    console.log(`  📨 Facebook Webhook: ${facebookWebhook}`);
    console.log(`  📷 Instagram Redirect: ${instagramRedirect}`);
    console.log(`  🐦 Twitter Redirect: ${twitterRedirect}`);
    console.log(`  💼 LinkedIn Redirect: ${linkedinRedirect}`);
    console.log(`  🔗 NextAuth URL: ${publicUrl}`);
    
    logSystemEvent('info', 'Environment updated with ngrok URLs', { 
      facebookRedirect, 
      facebookWebhook, 
      instagramRedirect, 
      twitterRedirect, 
      linkedinRedirect,
      nextAuthUrl: publicUrl
    });
    
  } catch (error) {
    console.error('❌ Error updating environment file:', error);
    logSystemEvent('error', 'Failed to update environment file', { error: error.message });
  }
}

async function getNgrokTunnel() {
  try {
    const response = await fetch(`http://localhost:${NGROK_API_PORT}/api/tunnels`);
    const data = await response.json();
    
    if (data.tunnels && data.tunnels.length > 0) {
      return data.tunnels[0].public_url;
    }
  } catch (error) {
    console.log('⏳ Waiting for ngrok tunnel...');
  }
  return null;
}

function startNgrok() {
  console.log('🌐 Starting ngrok tunnel...');
  logSystemEvent('info', 'Starting ngrok tunnel', { port: SERVER_PORT });
  
  ngrokProcess = spawn('ngrok', ['http', SERVER_PORT.toString()], {
    stdio: 'pipe',
    shell: true
  });
  
  ngrokProcess.on('spawn', () => {
    console.log('✅ Ngrok process started');
    logSystemEvent('info', 'Ngrok process started', { pid: ngrokProcess.pid });
  });
  
  ngrokProcess.on('error', (error) => {
    console.error('❌ Failed to start ngrok:', error);
    logSystemEvent('error', 'Ngrok startup failed', { error: error.message });
  });
  
  // Wait for ngrok to establish tunnel
  setTimeout(async () => {
    const publicUrl = await getNgrokTunnel();
    if
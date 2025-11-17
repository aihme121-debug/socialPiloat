const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

/**
 * Ngrok Integration Manager for SocialPiloat AI
 * Handles ngrok tunnel setup, monitoring, and URL management
 */
class NgrokManager {
  constructor(port = 7070) {
    this.port = port;
    this.process = null;
    this.publicUrl = null;
    this.isRunning = false;
    this.startupTimeout = 30000;
    this.apiTimeout = 5000;
  }

  /**
   * Start ngrok tunnel
   * @returns {Promise<string>} - Public URL
   */
  async start() {
    if (this.isRunning) {
      console.log('🌐 Ngrok is already running');
      return this.publicUrl;
    }

    return new Promise((resolve, reject) => {
      console.log(`🌐 Starting ngrok tunnel on port ${this.port}...`);
      
      this.process = spawn('ngrok', ['http', this.port.toString()], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });
      
      let startupResolved = false;
      
      this.process.stdout.on('data', async (data) => {
        const output = data.toString();
        console.log('Ngrok:', output.trim());
        
        // Look for successful startup indicators
        if (output.includes('started tunnel') || output.includes('Forwarding')) {
          if (!startupResolved) {
            startupResolved = true;
            
            try {
              // Wait a bit for the API to be ready
              setTimeout(async () => {
                try {
                  const publicUrl = await this.getPublicUrl();
                  this.publicUrl = publicUrl;
                  this.isRunning = true;
                  console.log(`✅ Ngrok tunnel established: ${publicUrl}`);
                  
                  await this.updateEnvironmentVariables(publicUrl);
                  resolve(publicUrl);
                  
                } catch (error) {
                  reject(error);
                }
              }, 3000);
              
            } catch (error) {
              reject(error);
            }
          }
        }
      });
      
      this.process.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('Ngrok error:', error.trim());
        
        if (!startupResolved) {
          startupResolved = true;
          reject(new Error(`Ngrok startup failed: ${error}`));
        }
      });
      
      this.process.on('error', (error) => {
        console.error('❌ Ngrok process error:', error.message);
        if (!startupResolved) {
          startupResolved = true;
          reject(error);
        }
      });
      
      this.process.on('exit', (code, signal) => {
        console.log(`🛑 Ngrok exited with code ${code} and signal ${signal}`);
        this.isRunning = false;
        this.publicUrl = null;
        
        if (!startupResolved) {
          startupResolved = true;
          reject(new Error(`Ngrok exited with code ${code}`));
        }
      });
      
      // Timeout handling
      setTimeout(() => {
        if (!startupResolved) {
          startupResolved = true;
          this.stop();
          reject(new Error('Ngrok startup timeout'));
        }
      }, this.startupTimeout);
    });
  }

  /**
   * Get public URL from ngrok API
   * @returns {Promise<string>} - Public URL
   */
  async getPublicUrl() {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 4040,
        path: '/api/tunnels',
        method: 'GET',
        timeout: this.apiTimeout
      }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const tunnels = JSON.parse(data);
            
            if (tunnels.tunnels && tunnels.tunnels.length > 0) {
              // Find the HTTP tunnel (not HTTPS)
              const httpTunnel = tunnels.tunnels.find(tunnel => 
                tunnel.proto === 'https' || tunnel.proto === 'http'
              );
              
              if (httpTunnel && httpTunnel.public_url) {
                resolve(httpTunnel.public_url);
              } else {
                reject(new Error('No suitable tunnel found'));
              }
            } else {
              reject(new Error('No active tunnels'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse ngrok API response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Ngrok API connection failed: ${error.message}`));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ngrok API timeout'));
      });
      
      req.end();
    });
  }

  /**
   * Update environment variables with ngrok URLs
   * @param {string} publicUrl - Public URL
   */
  async updateEnvironmentVariables(publicUrl) {
    const envFile = path.join(__dirname, '.env.local');
    
    try {
      let envContent = '';
      
      // Read existing content if file exists
      try {
        envContent = await fs.readFile(envFile, 'utf8');
      } catch (error) {
        // File doesn't exist, will create new content
      }
      
      // Generate URLs
      const urls = {
        FACEBOOK_REDIRECT_URI: `${publicUrl}/api/auth/social/facebook/callback`,
        FACEBOOK_WEBHOOK_CALLBACK_URL: `${publicUrl}/api/facebook/webhook`,
        INSTAGRAM_REDIRECT_URI: `${publicUrl}/api/auth/social/instagram/callback`,
        TWITTER_REDIRECT_URI: `${publicUrl}/api/auth/social/twitter/callback`,
        LINKEDIN_REDIRECT_URI: `${publicUrl}/api/auth/social/linkedin/callback`,
        NEXTAUTH_URL_PRODUCTION: publicUrl,
        NEXT_PUBLIC_SITE_URL: publicUrl,
        NGROK_URL: publicUrl
      };
      
      // Update or add each URL
      for (const [key, value] of Object.entries(urls)) {
        const regex = new RegExp(`^${key}=.*$`, 'gm');
        if (envContent.match(regex)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }
      
      await fs.writeFile(envFile, envContent);
      
      console.log('✅ Updated environment variables with ngrok URLs');
      console.log(`📱 Facebook Redirect: ${urls.FACEBOOK_REDIRECT_URI}`);
      console.log(`📡 Facebook Webhook: ${urls.FACEBOOK_WEBHOOK_CALLBACK_URL}`);
      
    } catch (error) {
      console.error('❌ Failed to update environment variables:', error.message);
      throw error;
    }
  }

  /**
   * Get tunnel status
   * @returns {Promise<Object>} - Tunnel status
   */
  async getStatus() {
    if (!this.isRunning) {
      return { running: false, publicUrl: null };
    }
    
    try {
      const publicUrl = await this.getPublicUrl();
      return {
        running: true,
        publicUrl,
        port: this.port,
        pid: this.process ? this.process.pid : null
      };
    } catch (error) {
      return {
        running: false,
        publicUrl: null,
        error: error.message
      };
    }
  }

  /**
   * Stop ngrok tunnel
   */
  stop() {
    if (this.process) {
      console.log('🛑 Stopping ngrok tunnel...');
      
      try {
        this.process.kill('SIGTERM');
        
        // Force kill after 5 seconds if not terminated
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            console.log('⚠️  Force killing ngrok process...');
            this.process.kill('SIGKILL');
          }
        }, 5000);
        
      } catch (error) {
        console.error('❌ Error stopping ngrok:', error.message);
      }
      
      this.process = null;
      this.isRunning = false;
      this.publicUrl = null;
      
      console.log('✅ Ngrok tunnel stopped');
    }
  }

  /**
   * Restart ngrok tunnel
   * @returns {Promise<string>} - New public URL
   */
  async restart() {
    console.log('🔄 Restarting ngrok tunnel...');
    this.stop();
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return await this.start();
  }

  /**
   * Check if ngrok is installed
   * @returns {Promise<boolean>}
   */
  static async isInstalled() {
    return new Promise((resolve) => {
      const process = spawn('ngrok', ['version'], {
        stdio: 'ignore',
        shell: true
      });
      
      process.on('exit', (code) => {
        resolve(code === 0);
      });
      
      process.on('error', () => {
        resolve(false);
      });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 3000);
    });
  }
}

module.exports = NgrokManager;
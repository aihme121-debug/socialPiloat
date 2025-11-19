import crypto from 'crypto';

/**
 * Secure Token Encryption Service
 * Provides AES-256-GCM encryption for Facebook access tokens and other sensitive data
 */
export class TokenEncryptionService {
  private static instance: TokenEncryptionService;
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly saltLength = 32; // 256 bits

  private constructor() {
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
    }
    
    // Derive a 32-byte key from the provided encryption key
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  static getInstance(): TokenEncryptionService {
    if (!TokenEncryptionService.instance) {
      TokenEncryptionService.instance = new TokenEncryptionService();
    }
    return TokenEncryptionService.instance;
  }

  /**
   * Encrypt a token or sensitive string
   */
  encrypt(text: string): string {
    try {
      // Generate random IV and salt
      const iv = crypto.randomBytes(this.ivLength);
      const salt = crypto.randomBytes(this.saltLength);

      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.key);
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine salt, IV, tag, and encrypted data
      const result = Buffer.concat([
        salt,
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      // Return base64 encoded result
      return result.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt an encrypted token
   */
  decrypt(encryptedData: string): string {
    try {
      // Decode from base64
      const buffer = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      let offset = 0;
      const salt = buffer.subarray(offset, offset + this.saltLength);
      offset += this.saltLength;
      
      const iv = buffer.subarray(offset, offset + this.ivLength);
      offset += this.ivLength;
      
      const tag = buffer.subarray(offset, offset + this.tagLength);
      offset += this.tagLength;
      
      const encrypted = buffer.subarray(offset);
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, this.key);
      decipher.setAuthTag(tag);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a secure random token for encryption keys
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a token for comparison purposes (not reversible)
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate that a token format is correct (basic validation)
   */
  validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Facebook access tokens typically start with 'EA' and are alphanumeric
    // Basic validation - can be extended based on specific token formats
    return token.length >= 10 && /^[A-Za-z0-9_-]+$/.test(token);
  }

  /**
   * Rotate encryption key (for key rotation scenarios)
   * This would decrypt all existing tokens and re-encrypt with new key
   */
  async rotateKey(oldKey: string, newKey: string): Promise<void> {
    // This is a placeholder for key rotation logic
    // In practice, you would:
    // 1. Decrypt all existing tokens with old key
    // 2. Re-encrypt with new key
    // 3. Update database records
    // 4. Update environment variable
    throw new Error('Key rotation not implemented in this version');
  }
}

// Export singleton instance
export const tokenEncryptionService = TokenEncryptionService.getInstance();
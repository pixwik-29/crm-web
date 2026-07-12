import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Hashing the ENCRYPTION_KEY guarantees a 32-byte key buffer for AES-256
const getEncryptionKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_KEY || 'perfectscholar_messaging_secret_key_fallback';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts clear-text token using AES-256-GCM
 */
export function encryptToken(text: string): { encryptedText: string; iv: string } {
  if (!text) return { encryptedText: '', iv: '' };
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedText: `${encrypted}:${authTag}`,
    iv: iv.toString('hex')
  };
}

/**
 * Decrypts encrypted token cipher using the corresponding IV
 */
export function decryptToken(encryptedData: string | null, ivHex: string | null): string {
  if (!encryptedData) return '';
  if (!ivHex) return encryptedData;
  
  try {
    const [encrypted, authTag] = encryptedData.split(':');
    if (!encrypted || !authTag) {
      // Fallback in case token was saved unencrypted during dev tests
      return encryptedData;
    }
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(ivHex, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err: any) {
    console.error('[Crypto] Decryption failed, returning raw string as fallback:', err.message);
    return encryptedData;
  }
}
export const isEncryptionConfigured = (): boolean => !!process.env.ENCRYPTION_KEY;

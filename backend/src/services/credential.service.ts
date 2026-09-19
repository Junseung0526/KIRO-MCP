// CredentialService: AES-256-GCM encryption/decryption for secrets stored at
// rest (e.g. the Notion integration token). The 32-byte key comes from
// CREDENTIAL_ENCRYPTION_KEY (.env) — never hardcoded, never logged.
//
// Encrypted format (base64): [12-byte IV][16-byte auth tag][ciphertext].
import crypto from 'node:crypto';
import { config } from '../config';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export class CredentialConfigError extends Error {}

function getKey(): Buffer {
  const hex = config.credentialEncryptionKey;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new CredentialConfigError(
      'CREDENTIAL_ENCRYPTION_KEY is not configured correctly (must be 64 hex chars = 32 bytes).',
    );
  }
  return Buffer.from(hex, 'hex');
}

export const credentialService = {
  isConfigured(): boolean {
    return /^[0-9a-fA-F]{64}$/.test(config.credentialEncryptionKey || '');
  },

  encrypt(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  },

  decrypt(payload: string): string {
    const key = getKey();
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = raw.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  },
};

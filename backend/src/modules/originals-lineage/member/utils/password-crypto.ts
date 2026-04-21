import * as crypto from 'crypto';

// 使用 AES-256-GCM 對官網密碼做可還原加密，用來之後同步寫回遊戲資料庫
// 金鑰放在環境變數 PASSWORD_ENC_KEY（32 bytes, 64 hex chars），DB 外洩時不會被解密

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

function getKey(): Buffer {
  const keyHex = process.env.PASSWORD_ENC_KEY;
  if (!keyHex) {
    throw new Error('PASSWORD_ENC_KEY environment variable is not set');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `PASSWORD_ENC_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars)`,
    );
  }
  return key;
}

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptPassword(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error('Invalid encrypted password payload');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

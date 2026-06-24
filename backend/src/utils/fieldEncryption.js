const crypto = require('crypto');

const KEY_HEX = process.env.FIELD_ENCRYPTION_KEY || '';
const IV_LENGTH = 16;

const getKey = () => {
  if (!KEY_HEX || KEY_HEX.length !== 64) return null;
  try {
    return Buffer.from(KEY_HEX, 'hex');
  } catch (_) {
    return null;
  }
};

const isEncryptedPayload = (value) => typeof value === 'string' && value.split(':').length === 3;

const deriveDeterministicIv = (text) =>
  crypto.createHash('sha256').update(String(text)).digest().subarray(0, IV_LENGTH);

const encrypt = (text) => {
  if (!text || isEncryptedPayload(text)) return text;
  const key = getKey();
  if (!key) return text;
  const iv = deriveDeterministicIv(text);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (text) => {
  if (!text || !isEncryptedPayload(text)) return text;
  const key = getKey();
  if (!key) return text;
  const [ivHex, tagHex, encryptedHex] = String(text).split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

module.exports = { encrypt, decrypt, isEncryptedPayload };

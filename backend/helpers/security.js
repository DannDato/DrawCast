import crypto from 'crypto';
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export function safeUserAgent(value) { return String(value || '').slice(0, 500); }

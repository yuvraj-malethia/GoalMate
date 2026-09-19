import crypto from 'node:crypto';

/**
 * Short, URL-safe ids such as "mfp2k1x0Xk3v9QaB". The first part is the
 * current time, so ids created later sort later; the rest is random.
 */
export function newId() {
  return Date.now().toString(36) + crypto.randomBytes(6).toString('base64url');
}

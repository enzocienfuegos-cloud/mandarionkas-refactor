import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const normalized = String(password || '');
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(normalized, salt, KEY_LENGTH);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const normalized = String(password || '');
  const [algorithm, salt, expectedHex] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const derived = Buffer.from(await scrypt(normalized, salt, expected.length || KEY_LENGTH));
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

function createSignature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function signOpaqueToken(value, secret) {
  if (!value || !secret) return '';
  return `${value}.${createSignature(value, secret)}`;
}

export function verifyOpaqueToken(token, secret) {
  if (!token || !secret) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const value = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createSignature(value, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(actualBuffer, expectedBuffer) ? value : null;
}

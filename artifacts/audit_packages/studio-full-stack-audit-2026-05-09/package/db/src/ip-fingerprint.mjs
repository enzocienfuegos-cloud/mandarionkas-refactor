import { createHmac } from 'node:crypto';

function getDailySalt(secret) {
  const today = new Date().toISOString().slice(0, 10);
  return `${today}:${secret}`;
}

export function hashIp(ip, secret) {
  if (!ip || !secret) return null;
  const salt = getDailySalt(secret);
  return createHmac('sha256', salt).update(ip).digest('hex').slice(0, 16);
}

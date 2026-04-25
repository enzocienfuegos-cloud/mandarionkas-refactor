const BASE_URL = (process.env.BASE_URL ?? '').trim();

export function getConfiguredBaseUrl() {
  if (BASE_URL) return BASE_URL.replace(/\/$/, '');
  return 'http://localhost:4000';
}

export function getRequestBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim();
  const host = String(req.headers.host ?? '').trim();
  const proto = forwardedProto || (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  const authority = forwardedHost || host;

  if (authority) return `${proto}://${authority}`;
  return getConfiguredBaseUrl();
}

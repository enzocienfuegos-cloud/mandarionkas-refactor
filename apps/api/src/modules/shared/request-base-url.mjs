const CONFIGURED_BASE_URL_ENVS = [
  'API_PUBLIC_BASE_URL',
  'API_BASE_URL',
  'BASE_URL',
  'VITE_API_BASE_URL',
];

export function getConfiguredBaseUrl() {
  for (const envName of CONFIGURED_BASE_URL_ENVS) {
    const value = String(process.env[envName] ?? '').trim();
    if (value) return value.replace(/\/$/, '');
  }
  return 'http://localhost:4000';
}

export function getRequestBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] ?? '').split(',')[0].trim();
  const authorityHeader = String(req.headers[':authority'] ?? '').trim();
  const hostHeader = String(req.headers.host ?? '').trim();
  const hostname = String(req.hostname ?? '').trim();
  const authority = forwardedHost || authorityHeader || hostHeader || hostname;
  const protocolHint = authority || hostHeader || hostname;
  const proto = forwardedProto
    || String(req.protocol ?? '').trim()
    || (protocolHint.includes('localhost') || protocolHint.startsWith('127.0.0.1') ? 'http' : 'https');

  if (authority) return `${proto}://${authority}`;
  return getConfiguredBaseUrl();
}

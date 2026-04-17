export class HttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `Request failed: ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

function isProxyUrl(url: string): boolean {
  try {
    const resolved = new URL(url, globalThis.location?.origin ?? 'http://localhost');
    return resolved.pathname === '/index.php' && resolved.searchParams.has('__proxy');
  } catch {
    return false;
  }
}

function readPlatformSessionRaw(): string | null {
  try {
    return (
      globalThis.localStorage?.getItem('smx-studio-v4:platform-session') ??
      globalThis.sessionStorage?.getItem('smx-studio-v4:platform-session') ??
      null
    );
  } catch {
    return null;
  }
}

function getAuthToken(): string {
  try {
    const raw = readPlatformSessionRaw();
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { sessionId?: string };
    return parsed?.sessionId?.trim() ?? '';
  } catch {
    return '';
  }
}

function shouldAttachAuth(url: string): boolean {
  try {
    const resolved = new URL(url, globalThis.location?.origin ?? 'http://localhost');
    const host = resolved.hostname;
    const path = resolved.pathname;

    if (host.endsWith('.r2.cloudflarestorage.com') || host.endsWith('.r2.dev')) {
      return false;
    }

    if (path === '/index.php' && resolved.searchParams.has('__proxy')) return true;
    if (path.startsWith('/api/')) return true;
    if (path.startsWith('/auth')) return true;
    if (path.startsWith('/projects')) return true;
    if (path.startsWith('/assets')) return true;
    if (path.startsWith('/documents')) return true;

    return false;
  } catch {
    return false;
  }
}

function buildHeaders(url: string, init?: RequestInit, json = true): Headers {
  const headers = new Headers(init?.headers ?? undefined);
  const method = String(init?.method ?? 'GET').toUpperCase();
  const hasBody = init?.body != null && method !== 'GET' && method !== 'HEAD';
  const proxyUrl = isProxyUrl(url);

  if (json && hasBody && !proxyUrl && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token && !headers.has('Authorization') && shouldAttachAuth(url)) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

function normalizeRequest(url: string, init?: RequestInit, json = true): RequestInit {
  const method = String(init?.method ?? 'GET').toUpperCase();
  const proxyUrl = isProxyUrl(url);
  const stringBody = typeof init?.body === 'string' ? init.body : null;
  const hasJsonStringBody = json && stringBody !== null && method !== 'GET' && method !== 'HEAD';

  if (!proxyUrl || !hasJsonStringBody) {
    return {
      ...init,
      headers: buildHeaders(url, init, json),
    };
  }

  const headers = buildHeaders(url, init, false);
  headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

  const payload = new URLSearchParams();
  payload.set('__smx_body', stringBody);
  payload.set('__smx_content_type', 'application/json');

  return {
    ...init,
    headers,
    body: payload.toString(),
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text || `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, normalizeRequest(url, init, true));

  if (!response.ok) {
    throw new HttpError(response.status, await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function fetchOptionalJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, normalizeRequest(url, init, true));

  if (response.status === 204) return null;
  if (!response.ok) {
    throw new HttpError(response.status, await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function fetchVoid(url: string, init?: RequestInit): Promise<void> {
  const response = await fetch(url, normalizeRequest(url, init, false));

  if (!response.ok) {
    throw new HttpError(response.status, await readErrorMessage(response));
  }
}

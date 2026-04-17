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

function buildHeaders(init?: RequestInit, json = true): Headers {
  const headers = new Headers(init?.headers ?? undefined);
  const method = String(init?.method ?? 'GET').toUpperCase();
  const hasBody = init?.body != null && method !== 'GET' && method !== 'HEAD';

  if (json && hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

function normalizeRequest(init?: RequestInit, json = true): RequestInit {
  return {
    ...init,
    headers: buildHeaders(init, json),
    credentials: init?.credentials ?? 'include',
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
  const response = await fetch(url, normalizeRequest(init, true));

  if (!response.ok) {
    throw new HttpError(response.status, await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function fetchOptionalJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, normalizeRequest(init, true));

  if (response.status === 204) return null;
  if (!response.ok) {
    throw new HttpError(response.status, await readErrorMessage(response));
  }

  return response.json() as Promise<T>;
}

export async function fetchVoid(url: string, init?: RequestInit): Promise<void> {
  const response = await fetch(url, normalizeRequest(init, false));

  if (!response.ok) {
    throw new HttpError(response.status, await readErrorMessage(response));
  }
}

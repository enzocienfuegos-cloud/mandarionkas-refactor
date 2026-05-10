import type {
  CreateBrandRequestDto,
  CreateBrandResponseDto,
  CreateClientRequestDto,
  CreateClientResponseDto,
  InviteMemberRequestDto,
  InviteMemberResponseDto,
  LoginRequestDto,
  LoginResponseDto,
  LogoutResponseDto,
  SessionResponseDto,
  UpdateActiveClientRequestDto,
  UpdateActiveClientResponseDto,
} from '@smx/contracts';
import type { PlatformStorageDiagnostics } from './types';
import { getRepositoryApiBase } from '../repositories/api-config';
import { fetchJson, fetchVoid, HttpError } from '../shared/net/http-json';

const SESSION_BOOTSTRAP_TIMEOUT_MS = 8_000;

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:platform-api-base');
}

function parseErrorBody<T>(error: unknown): T | null {
  if (!(error instanceof HttpError)) return null;
  try {
    return JSON.parse(error.body) as T;
  } catch {
    return null;
  }
}

export async function requestPlatformSession(): Promise<SessionResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;

  const controller = typeof AbortController === 'undefined' ? null : new AbortController();
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), SESSION_BOOTSTRAP_TIMEOUT_MS)
    : null;

  try {
    return await fetchJson<SessionResponseDto>(`${base}/auth/session`, controller ? { signal: controller.signal } : undefined);
  } catch {
    return null;
  } finally {
    if (timeout != null) window.clearTimeout(timeout);
  }
}

export async function requestPlatformLogin(payload: LoginRequestDto): Promise<LoginResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<LoginResponseDto>(`${base}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return parseErrorBody<LoginResponseDto>(error) ?? null;
  }
}

export async function requestPlatformLogout(): Promise<LogoutResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    await fetchVoid(`${base}/auth/logout`, {
      method: 'POST',
    });
    return { ok: true };
  } catch {
    return null;
  }
}

export async function requestSetActiveClient(payload: UpdateActiveClientRequestDto): Promise<UpdateActiveClientResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<UpdateActiveClientResponseDto>(`${base}/clients/active`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return parseErrorBody<UpdateActiveClientResponseDto>(error) ?? null;
  }
}

export async function requestCreateClient(payload: CreateClientRequestDto): Promise<CreateClientResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<CreateClientResponseDto>(`${base}/clients`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return parseErrorBody<CreateClientResponseDto>(error) ?? null;
  }
}

export async function requestCreateBrand(clientId: string, payload: CreateBrandRequestDto): Promise<CreateBrandResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<CreateBrandResponseDto>(`${base}/clients/${clientId}/brands`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return parseErrorBody<CreateBrandResponseDto>(error) ?? null;
  }
}

export async function requestInviteMember(clientId: string, payload: InviteMemberRequestDto): Promise<InviteMemberResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<InviteMemberResponseDto>(`${base}/clients/${clientId}/invites`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return parseErrorBody<InviteMemberResponseDto>(error) ?? null;
  }
}

export async function requestStorageDiagnostics(): Promise<PlatformStorageDiagnostics | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<PlatformStorageDiagnostics>(`${base}/admin/storage/diagnostics`);
  } catch {
    return null;
  }
}

export async function requestRebuildStorageIndexes(): Promise<PlatformStorageDiagnostics | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<PlatformStorageDiagnostics>(`${base}/admin/storage/rebuild`, {
      method: 'POST',
    });
  } catch {
    return null;
  }
}

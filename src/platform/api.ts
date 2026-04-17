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
  UpdateActiveClientRequestDto,
  UpdateActiveClientResponseDto,
} from '../types/contracts';
import type { PlatformStorageDiagnostics } from './types';
import { readStorageItem } from '../shared/browser/storage';
import { fetchJson } from '../shared/net/http-json';

const PLATFORM_API_BASE_KEY = 'smx-studio-v4:platform-api-base';

function getBaseUrl(): string {
  return readStorageItem(PLATFORM_API_BASE_KEY, '').trim().replace(/\/$/, '');
}

export async function requestPlatformLogin(payload: LoginRequestDto): Promise<LoginResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<LoginResponseDto>(`${base}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return null;
  }
}

export async function requestPlatformLogout(): Promise<LogoutResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<LogoutResponseDto>(`${base}/auth/logout`, {
      method: 'POST',
    });
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
  } catch {
    return null;
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
  } catch {
    return null;
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
  } catch {
    return null;
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
  } catch {
    return null;
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

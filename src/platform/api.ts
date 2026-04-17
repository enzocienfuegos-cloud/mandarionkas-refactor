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
import { fetchJson, HttpError } from '../shared/net/http-json';
import { getPlatformApiBaseUrl } from '../shared/runtime/api-base';

function getBaseUrl(): string {
  return getPlatformApiBaseUrl();
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

export async function requestPlatformSession(): Promise<LoginResponseDto | null> {
  const base = getBaseUrl();
  if (!base) return null;
  try {
    return await fetchJson<LoginResponseDto>(`${base}/auth/session`);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null;
    throw error;
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

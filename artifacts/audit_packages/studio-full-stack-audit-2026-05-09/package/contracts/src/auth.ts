// packages/contracts/src/auth.ts

import type {
  PlatformPermission,
  PlatformRole,
  ProductAccess,
  SessionPersistenceMode,
  WorkspaceRole,
} from './platform';

export type { PlatformRole, WorkspaceRole, PlatformPermission, ProductAccess };

// ---------------------------------------------------------------------------
// Session payload
// ---------------------------------------------------------------------------

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  /** Always a valid PlatformRole — never a raw legacy string. */
  role: PlatformRole;
}

export interface AuthWorkspaceMemberDto {
  userId: string;
  role: WorkspaceRole;
  addedAt: string;
  productAccess: ProductAccess;
}

export interface AuthBrandDto {
  id: string;
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  fontFamily?: string;
}

export interface AuthClientInviteDto {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted';
  invitedAt: string;
}

export interface AuthWorkspaceDto {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  memberUserIds: string[];
  /** Effective access for the requesting user within this workspace. */
  product_access: ProductAccess;
  members?: AuthWorkspaceMemberDto[];
  invites?: AuthClientInviteDto[];
  brands?: AuthBrandDto[];
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

export interface LoginRequestDto {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponseDto {
  ok: boolean;
  message?: string;
  authenticated: true;
  session: {
    sessionId: string;
    persistenceMode: SessionPersistenceMode;
    issuedAt: string;
    expiresAt: string;
  };
  user: AuthUserDto;
  activeClientId?: string;
  activeWorkspaceId?: string;
  /** Resolved effective product access for the active workspace. */
  productAccess: ProductAccess;
  permissions: PlatformPermission[];
  clients: AuthWorkspaceDto[];
  workspaces: AuthWorkspaceDto[];
}

export interface UnauthenticatedResponseDto {
  ok: true;
  authenticated: false;
  session: null;
  user: null;
  activeClientId: undefined;
  activeWorkspaceId: undefined;
  permissions: [];
  productAccess: null;
  clients: [];
  workspaces: [];
}

export type SessionResponseDto = LoginResponseDto | UnauthenticatedResponseDto;

export interface LogoutResponseDto {
  ok: true;
}

// ---------------------------------------------------------------------------
// Workspace / client operations
// ---------------------------------------------------------------------------

export interface UpdateActiveClientRequestDto {
  clientId: string;
}

export interface UpdateActiveClientResponseDto {
  ok: true;
  activeClientId: string;
  clients: AuthWorkspaceDto[];
}

export interface CreateClientRequestDto {
  name: string;
}

export interface CreateClientResponseDto {
  ok: true;
  client: AuthWorkspaceDto;
  activeClientId: string;
  clients: AuthWorkspaceDto[];
}

export interface CreateBrandRequestDto {
  name: string;
  primaryColor: string;
}

export interface CreateBrandResponseDto {
  ok: true;
  client: AuthWorkspaceDto;
  clients: AuthWorkspaceDto[];
}

export interface InviteMemberRequestDto {
  email: string;
  role: WorkspaceRole;
  productAccess: ProductAccess;
}

export interface InviteMemberResponseDto {
  ok: boolean;
  message?: string;
  client?: AuthWorkspaceDto;
  clients?: AuthWorkspaceDto[];
}

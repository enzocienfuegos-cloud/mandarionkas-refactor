import type { PlatformPermission, SessionPersistenceMode, UserRole, WorkspaceRole } from './platform';

export type AuthUserDto = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthWorkspaceMemberDto = {
  userId: string;
  role: WorkspaceRole;
  addedAt: string;
};

export type AuthBrandDto = {
  id: string;
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  fontFamily?: string;
};

export type AuthClientInviteDto = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted';
  invitedAt: string;
};

export type AuthWorkspaceDto = {
  id: string;
  name: string;
  slug: string;
  brandColor?: string;
  ownerUserId: string;
  memberUserIds: string[];
  members?: AuthWorkspaceMemberDto[];
  invites?: AuthClientInviteDto[];
  brands?: AuthBrandDto[];
};

export type LoginRequestDto = {
  email: string;
  password: string;
  remember?: boolean;
};

export type AuthSessionDto = {
  sessionId: string;
  persistenceMode: SessionPersistenceMode;
  issuedAt: string;
  expiresAt: string;
};

export type AuthSessionPayloadDto = {
  ok: true;
  authenticated: true;
  session: AuthSessionDto;
  user: AuthUserDto;
  activeClientId?: string;
  activeWorkspaceId?: string;
  permissions: PlatformPermission[];
  clients: AuthWorkspaceDto[];
  workspaces: AuthWorkspaceDto[];
};

export type AuthAnonymousSessionDto = {
  ok: true;
  authenticated: false;
  session: null;
  user: null;
  activeClientId?: undefined;
  activeWorkspaceId?: undefined;
  permissions: PlatformPermission[];
  clients: AuthWorkspaceDto[];
  workspaces: AuthWorkspaceDto[];
};

export type SessionResponseDto = AuthSessionPayloadDto | AuthAnonymousSessionDto;

export type LoginErrorDto = {
  ok: false;
  message?: string;
  code?: string;
};

export type LoginResponseDto = AuthSessionPayloadDto | LoginErrorDto;

export type LogoutResponseDto = { ok: true };

export type UpdateActiveClientRequestDto = { clientId: string };

export type UpdateActiveClientResponseDto = {
  ok: true;
  activeClientId: string;
  activeWorkspaceId?: string;
  clients: AuthWorkspaceDto[];
  workspaces?: AuthWorkspaceDto[];
};

export type CreateClientRequestDto = { name: string };

export type CreateClientResponseDto = {
  ok: true;
  client: AuthWorkspaceDto;
  workspace?: AuthWorkspaceDto;
  activeClientId: string;
  activeWorkspaceId?: string;
  clients: AuthWorkspaceDto[];
  workspaces?: AuthWorkspaceDto[];
};

export type CreateBrandRequestDto = {
  name: string;
  primaryColor: string;
};

export type CreateBrandResponseDto = {
  ok: true;
  client: AuthWorkspaceDto;
  workspace?: AuthWorkspaceDto;
  clients: AuthWorkspaceDto[];
  workspaces?: AuthWorkspaceDto[];
};

export type InviteMemberRequestDto = {
  email: string;
  role: WorkspaceRole;
};

export type InviteMemberResponseDto = {
  ok: boolean;
  message?: string;
  client?: AuthWorkspaceDto;
  workspace?: AuthWorkspaceDto;
  clients?: AuthWorkspaceDto[];
  workspaces?: AuthWorkspaceDto[];
};

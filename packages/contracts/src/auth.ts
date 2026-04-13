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

export type LoginResponseDto = {
  ok: boolean;
  message?: string;
  session: {
    sessionId: string;
    persistenceMode: SessionPersistenceMode;
    issuedAt: string;
    expiresAt: string;
  };
  user: AuthUserDto;
  activeClientId?: string;
  permissions: PlatformPermission[];
  clients: AuthWorkspaceDto[];
};

export type LogoutResponseDto = {
  ok: true;
};

export type UpdateActiveClientRequestDto = {
  clientId: string;
};

export type UpdateActiveClientResponseDto = {
  ok: true;
  activeClientId: string;
  clients: AuthWorkspaceDto[];
};

export type CreateClientRequestDto = {
  name: string;
};

export type CreateClientResponseDto = {
  ok: true;
  client: AuthWorkspaceDto;
  activeClientId: string;
  clients: AuthWorkspaceDto[];
};

export type CreateBrandRequestDto = {
  name: string;
  primaryColor: string;
};

export type CreateBrandResponseDto = {
  ok: true;
  client: AuthWorkspaceDto;
  clients: AuthWorkspaceDto[];
};

export type InviteMemberRequestDto = {
  email: string;
  role: WorkspaceRole;
};

export type InviteMemberResponseDto = {
  ok: boolean;
  message?: string;
  client?: AuthWorkspaceDto;
  clients?: AuthWorkspaceDto[];
};

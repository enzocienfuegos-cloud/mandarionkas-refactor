import type { AssetAccessScope, ProjectAccessScope } from '@smx/contracts';
import type {
  PlatformPermission,
  SessionPersistenceMode,
  UserRole,
  WorkspaceRole,
} from '@smx/contracts';

export type { ProjectAccessScope, AssetAccessScope, PlatformPermission, SessionPersistenceMode, UserRole, WorkspaceRole };

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role?: WorkspaceRole;
  avatarUrl?: string | null;
};

export type BrandKit = {
  id: string;
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  fontFamily?: string;
};

export type ClientMember = {
  userId: string;
  role: WorkspaceRole;
  addedAt: string;
};

export type ClientInvite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'accepted';
  invitedAt: string;
};

export type ClientWorkspace = {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  logoUrl?: string | null;
  brandColor?: string;
  ownerUserId?: string;
  memberUserIds?: string[];
  members?: ClientMember[];
  invites?: ClientInvite[];
  brands?: BrandKit[];
};

export type PlatformAuditAction =
  | 'session.bootstrap'
  | 'session.login'
  | 'session.logout'
  | 'client.create'
  | 'client.update'
  | 'client.member.invite'
  | 'client.member.remove'
  | 'client.member.role'
  | 'brand.create'
  | 'brand.update'
  | 'brand.remove';

export type PlatformAuditTarget = 'session' | 'client' | 'member' | 'brand';

export type PlatformAuditEntry = {
  id: string;
  action: PlatformAuditAction;
  target: PlatformAuditTarget;
  actorUserId?: string;
  actorName?: string;
  clientId?: string;
  targetId?: string;
  summary: string;
  at: string;
};

export type PlatformSession = {
  currentUser?: PlatformUser;
  activeClientId?: string;
  isAuthenticated: boolean;
  permissions: PlatformPermission[];
  sessionId?: string;
  persistenceMode?: SessionPersistenceMode;
  issuedAt?: string;
  expiresAt?: string;
};

export type PlatformState = {
  clients: ClientWorkspace[];
  session: PlatformSession;
  auditLog: PlatformAuditEntry[];
};

export type PlatformStorageDiagnostics = {
  ok: boolean;
  generatedAt: string;
  backend?: string;
  storageModel?: string;
  legacyStorePresent: boolean;
  totals: {
    clients: number;
    projects: number;
    projectStates: number;
    projectVersions: number;
    projectVersionStates: number;
    assetFolders: number;
    assets: number;
    binaryObjects: number;
    clientSidecars: number;
    projectSidecars: number;
    projectStateSidecars: number;
    projectVersionSidecars: number;
    projectVersionStateSidecars: number;
    assetFolderSidecars: number;
    assetSidecars: number;
  };
  issues: {
    indexedClientsMissingSidecar: string[];
    clientSidecarsMissingIndex: string[];
    indexedProjectsMissingSidecar: string[];
    projectSidecarsMissingIndex: string[];
    indexedProjectStatesMissingSidecar: string[];
    projectStateSidecarsMissingIndex: string[];
    indexedVersionsMissingSidecar: string[];
    versionSidecarsMissingIndex: string[];
    indexedVersionStatesMissingSidecar: string[];
    versionStateSidecarsMissingIndex: string[];
    indexedAssetsMissingSidecar: string[];
    assetSidecarsMissingIndex: string[];
    assetSidecarsMissingBinary: Array<{ id: string; storageKey?: string }>;
  };
  notes?: string[];
};

import { getRolePermissions } from './role-permissions';
import brandingDefaults from '../../config/branding-defaults.json';
import type {
  BrandKit,
  ClientInvite,
  ClientMember,
  ClientWorkspace,
  PlatformAuditAction,
  PlatformAuditEntry,
  PlatformSession,
  PlatformSessionRecord,
  PlatformState,
  PlatformUser,
  SessionPersistenceMode,
  WorkspaceRole,
} from './types';

const MAX_AUDIT_ENTRIES = 80;
const LOCAL_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const EPHEMERAL_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function futureIso(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

function buildBrand(name: string, primaryColor: string, extra?: Partial<BrandKit>): BrandKit {
  return {
    id: createId('brand'),
    name,
    primaryColor,
    secondaryColor: extra?.secondaryColor ?? brandingDefaults.secondaryColor,
    accentColor: extra?.accentColor ?? primaryColor ?? brandingDefaults.accentColor,
    logoUrl: extra?.logoUrl,
    fontFamily: extra?.fontFamily ?? brandingDefaults.fontFamily,
  };
}

function buildMember(userId: string, role: WorkspaceRole): ClientMember {
  return { userId, role, addedAt: now() };
}

function normalizeMembers(client: ClientWorkspace): ClientWorkspace {
  const baseMembers = client.members?.length
    ? client.members
    : client.memberUserIds.map((userId) => buildMember(userId, userId === client.ownerUserId ? 'owner' : 'editor'));

  const uniqueMembers = Array.from(new Map(baseMembers.map((member) => [member.userId, member])).values());
  return {
    ...client,
    memberUserIds: Array.from(new Set([client.ownerUserId, ...uniqueMembers.map((member) => member.userId)])),
    members: uniqueMembers,
    invites: client.invites ?? [],
  };
}

function sanitizeUser(user: PlatformUser): Omit<PlatformUser, 'password'> {
  const { password, ...safe } = user;
  return safe;
}

function createEmptySession(activeClientId?: string): PlatformSession {
  return {
    currentUser: undefined,
    activeClientId,
    isAuthenticated: false,
    permissions: [],
    sessionId: undefined,
    persistenceMode: undefined,
    issuedAt: undefined,
    expiresAt: undefined,
  };
}

function buildDefaultState(): PlatformState {
  return {
    users: [],
    clients: [],
    session: createEmptySession(undefined),
    auditLog: [],
  };
}

export function readPlatformState(): PlatformState {
  return buildDefaultState();
}

export function writePlatformState(state: PlatformState): void {
  void state;
}

export function createSessionRecord(
  userId: string,
  activeClientId: string | undefined,
  persistenceMode: SessionPersistenceMode = 'local',
  sessionId?: string,
  issuedAt?: string,
  expiresAt?: string,
): PlatformSessionRecord {
  const resolvedIssuedAt = issuedAt ?? now();
  return {
    userId,
    activeClientId,
    sessionId: sessionId ?? createId('session'),
    persistenceMode,
    issuedAt: resolvedIssuedAt,
    expiresAt:
      expiresAt ??
      (persistenceMode === 'local'
        ? futureIso(LOCAL_SESSION_TTL_MS)
        : futureIso(EPHEMERAL_SESSION_TTL_MS)),
  };
}

export function clearPlatformSessionStorage(): void {
  return;
}

export function createClientWorkspace(name: string, ownerUserId: string): ClientWorkspace {
  return normalizeMembers({
    id: createId('client'),
    name,
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brandColor: brandingDefaults.brandColor,
    ownerUserId,
    memberUserIds: [ownerUserId],
    members: [buildMember(ownerUserId, 'owner')],
    invites: [],
    brands: [buildBrand(brandingDefaults.defaultBrandName, brandingDefaults.brandColor)],
  });
}

export function createBrandKit(name: string, primaryColor: string): BrandKit {
  return buildBrand(name, primaryColor || brandingDefaults.brandColor);
}

export function createClientInvite(email: string, role: WorkspaceRole): ClientInvite {
  return {
    id: createId('invite'),
    email,
    role,
    status: 'pending',
    invitedAt: now(),
  };
}

export function addMemberToClient(client: ClientWorkspace, userId: string, role: WorkspaceRole): ClientWorkspace {
  const members = [...(client.members ?? [])];
  const existing = members.find((item) => item.userId === userId);
  if (existing) {
    existing.role = role;
  } else {
    members.push(buildMember(userId, role));
  }
  return normalizeMembers({ ...client, members });
}

export function createAuditEntry(input: {
  action: PlatformAuditAction;
  target: PlatformAuditEntry['target'];
  summary: string;
  actor?: PlatformState['session']['currentUser'];
  clientId?: string;
  targetId?: string;
  at?: string;
}): PlatformAuditEntry {
  return {
    id: createId('audit'),
    action: input.action,
    target: input.target,
    actorUserId: input.actor?.id,
    actorName: input.actor?.name,
    clientId: input.clientId,
    targetId: input.targetId,
    summary: input.summary,
    at: input.at ?? now(),
  };
}

export function appendAuditEntry(state: PlatformState, entry: PlatformAuditEntry): PlatformState {
  return {
    ...state,
    auditLog: [entry, ...state.auditLog].slice(0, MAX_AUDIT_ENTRIES),
  };
}

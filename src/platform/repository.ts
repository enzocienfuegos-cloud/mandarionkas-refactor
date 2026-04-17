import {
  canUseBrowserStorage,
  canUseScopedBrowserStorage,
  readScopedStorageItem,
  removeScopedStorageItem,
  writeScopedStorageItem,
  writeStorageItem,
  readStorageItem,
} from '../shared/browser/storage';
import { getRolePermissions } from './role-permissions';
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

const PLATFORM_STORAGE_KEY = 'smx-studio-v4:platform-state';
const PLATFORM_SESSION_STORAGE_KEY = 'smx-studio-v4:platform-session';
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
    secondaryColor: extra?.secondaryColor ?? '#0f172a',
    accentColor: extra?.accentColor ?? primaryColor,
    logoUrl: extra?.logoUrl,
    fontFamily: extra?.fontFamily ?? 'Inter, system-ui, sans-serif',
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
  const adminId = createId('user');
  const editorId = createId('user');
  const reviewerId = createId('user');
  const clients: ClientWorkspace[] = [
    normalizeMembers({
      id: createId('client'),
      name: 'Default Client',
      slug: 'default-client',
      brandColor: '#8b5cf6',
      ownerUserId: adminId,
      memberUserIds: [adminId, editorId, reviewerId],
      members: [buildMember(adminId, 'owner'), buildMember(editorId, 'editor'), buildMember(reviewerId, 'reviewer')],
      invites: [],
      brands: [buildBrand('Core Brand', '#8b5cf6', { accentColor: '#ec4899' }), buildBrand('Performance Brand', '#22c55e', { accentColor: '#06b6d4' })],
    }),
    normalizeMembers({
      id: createId('client'),
      name: 'Retail Group',
      slug: 'retail-group',
      brandColor: '#06b6d4',
      ownerUserId: adminId,
      memberUserIds: [adminId, editorId],
      members: [buildMember(adminId, 'owner'), buildMember(editorId, 'editor')],
      invites: [],
      brands: [buildBrand('Retail Main', '#06b6d4', { accentColor: '#f59e0b' })],
    }),
  ];
  const users: PlatformUser[] = [
    { id: adminId, name: 'SMX Admin', email: 'admin@smx.studio', password: 'demo123', role: 'admin' },
    { id: editorId, name: 'Client Editor', email: 'editor@smx.studio', password: 'demo123', role: 'editor' },
    { id: reviewerId, name: 'Client Reviewer', email: 'reviewer@smx.studio', password: 'demo123', role: 'reviewer' },
  ];
  return {
    users,
    clients,
    session: createEmptySession(clients[0]?.id),
    auditLog: [],
  };
}

type PersistedPlatformState = Omit<PlatformState, 'session'> & {
  session: Pick<PlatformSession, 'activeClientId'>;
};

function serializePlatformState(state: PlatformState): PersistedPlatformState {
  return {
    users: state.users,
    clients: state.clients,
    auditLog: state.auditLog.slice(0, MAX_AUDIT_ENTRIES),
    session: { activeClientId: state.session.activeClientId },
  };
}

function parseState(raw: string | null): PersistedPlatformState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPlatformState>;
    if (!parsed?.users?.length || !parsed?.clients?.length) return null;
    return {
      users: parsed.users,
      clients: parsed.clients.map((client) =>
        normalizeMembers({
          ...client,
          memberUserIds: client.memberUserIds?.length ? client.memberUserIds : [client.ownerUserId],
          brands: client.brands?.length
            ? client.brands.map((brand) => ({
                ...brand,
                secondaryColor: brand.secondaryColor ?? '#0f172a',
                accentColor: brand.accentColor ?? brand.primaryColor,
                fontFamily: brand.fontFamily ?? 'Inter, system-ui, sans-serif',
              }))
            : [buildBrand(`${client.name} Brand`, client.brandColor ?? '#8b5cf6')],
        }),
      ),
      auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog.slice(0, MAX_AUDIT_ENTRIES) : [],
      session: {
        activeClientId: parsed.session?.activeClientId,
      },
    };
  } catch {
    return null;
  }
}

function clearPersistedSession(): void {
  removeScopedStorageItem(PLATFORM_SESSION_STORAGE_KEY, 'persistent');
  removeScopedStorageItem(PLATFORM_SESSION_STORAGE_KEY, 'session');
}

function readSessionRecordFromStorage(kind: SessionPersistenceMode): PlatformSessionRecord | null {
  const scope = kind === 'local' ? 'persistent' : 'session';
  if (!canUseScopedBrowserStorage(scope)) return null;
  const raw = readScopedStorageItem(PLATFORM_SESSION_STORAGE_KEY, '', scope);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlatformSessionRecord;
    if (!parsed?.userId || !parsed.sessionId || !parsed.expiresAt || !parsed.issuedAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      removeScopedStorageItem(PLATFORM_SESSION_STORAGE_KEY, scope);
      return null;
    }
    return parsed;
  } catch {
    removeScopedStorageItem(PLATFORM_SESSION_STORAGE_KEY, scope);
    return null;
  }
}

function readPersistedSession(): PlatformSessionRecord | null {
  return readSessionRecordFromStorage('session') ?? readSessionRecordFromStorage('local');
}

function writePlatformSessionRecord(record?: PlatformSessionRecord): void {
  clearPersistedSession();
  if (!record) return;
  writeScopedStorageItem(
    PLATFORM_SESSION_STORAGE_KEY,
    JSON.stringify(record),
    record.persistenceMode === 'local' ? 'persistent' : 'session',
  );
}

function applyPersistedSession(base: PersistedPlatformState): PlatformState {
  const persistedSession = readPersistedSession();
  const state: PlatformState = {
    users: base.users,
    clients: base.clients,
    auditLog: base.auditLog.slice(0, MAX_AUDIT_ENTRIES),
    session: createEmptySession(base.session.activeClientId ?? base.clients[0]?.id),
  };
  if (!persistedSession) return state;
  const user = state.users.find((entry) => entry.id === persistedSession.userId);
  if (!user) {
    clearPersistedSession();
    return state;
  }
  const activeClientId =
    persistedSession.activeClientId ??
    state.clients.find((client) => client.memberUserIds.includes(user.id))?.id ??
    state.clients[0]?.id;

  return {
    ...state,
    session: {
      currentUser: sanitizeUser(user),
      activeClientId,
      isAuthenticated: true,
      permissions: getRolePermissions(user.role),
      sessionId: persistedSession.sessionId,
      persistenceMode: persistedSession.persistenceMode,
      issuedAt: persistedSession.issuedAt,
      expiresAt: persistedSession.expiresAt,
    },
  };
}

export function readPlatformState(): PlatformState {
  const fallback = buildDefaultState();
  if (!canUseBrowserStorage()) return fallback;
  const parsed = parseState(readStorageItem(PLATFORM_STORAGE_KEY));
  if (!parsed) {
    writePlatformState(fallback);
    return fallback;
  }
  const state = applyPersistedSession(parsed);
  writePlatformState(state);
  return state;
}

export function writePlatformState(state: PlatformState): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(PLATFORM_STORAGE_KEY, JSON.stringify(serializePlatformState(state)));
  if (
    !state.session.isAuthenticated ||
    !state.session.currentUser ||
    !state.session.sessionId ||
    !state.session.persistenceMode ||
    !state.session.issuedAt ||
    !state.session.expiresAt
  ) {
    writePlatformSessionRecord(undefined);
    return;
  }
  writePlatformSessionRecord({
    userId: state.session.currentUser.id,
    activeClientId: state.session.activeClientId,
    sessionId: state.session.sessionId,
    persistenceMode: state.session.persistenceMode,
    issuedAt: state.session.issuedAt,
    expiresAt: state.session.expiresAt,
  });
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
  clearPersistedSession();
}

export function createClientWorkspace(name: string, ownerUserId: string): ClientWorkspace {
  return normalizeMembers({
    id: createId('client'),
    name,
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brandColor: '#8b5cf6',
    ownerUserId,
    memberUserIds: [ownerUserId],
    members: [buildMember(ownerUserId, 'owner')],
    invites: [],
    brands: [buildBrand('Primary Brand', '#8b5cf6')],
  });
}

export function createBrandKit(name: string, primaryColor: string): BrandKit {
  return buildBrand(name, primaryColor || '#8b5cf6');
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
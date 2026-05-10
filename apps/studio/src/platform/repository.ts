import type {
  BrandKit,
  ClientInvite,
  ClientMember,
  ClientWorkspace,
  PlatformAuditAction,
  PlatformAuditEntry,
  PlatformState,
  WorkspaceRole,
} from './types';

const MAX_AUDIT_ENTRIES = 80;
const PLATFORM_STATE_STORAGE_KEY = 'smx-studio-v4:platform-state';

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function buildMember(userId: string, role: WorkspaceRole): ClientMember {
  return { userId, role, addedAt: now() };
}

function normalizeMembers(client: ClientWorkspace): ClientWorkspace {
  const baseMembers = client.members?.length
    ? client.members
    : (client.memberUserIds ?? []).map((userId) => buildMember(userId, userId === client.ownerUserId ? 'owner' : 'editor'));

  const uniqueMembers = Array.from(new Map(baseMembers.map((member) => [member.userId, member])).values());
  const allIds = [...uniqueMembers.map((member) => member.userId), ...(client.ownerUserId ? [client.ownerUserId] : [])];
  return {
    ...client,
    memberUserIds: Array.from(new Set(allIds)),
    members: uniqueMembers,
    invites: client.invites ?? [],
  };
}

export function readPlatformState(): PlatformState {
  const emptyState: PlatformState = {
    clients: [],
    session: {
      currentUser: undefined,
      activeClientId: undefined,
      isAuthenticated: false,
      permissions: [],
      sessionId: undefined,
      persistenceMode: undefined,
      issuedAt: undefined,
      expiresAt: undefined,
    },
    auditLog: [],
  };

  if (typeof globalThis.localStorage === 'undefined' && typeof globalThis.sessionStorage === 'undefined') return emptyState;

  const raw =
    globalThis.localStorage?.getItem(PLATFORM_STATE_STORAGE_KEY)
    ?? globalThis.sessionStorage?.getItem(PLATFORM_STATE_STORAGE_KEY);

  if (!raw) return emptyState;

  try {
    const parsed = JSON.parse(raw) as PlatformState;
    const expiresAt = parsed.session.expiresAt ? new Date(parsed.session.expiresAt).getTime() : null;
    if (expiresAt && Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      clearPlatformSessionStorage();
      return emptyState;
    }
    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients.map(normalizeMembers) : [],
      session: {
        ...emptyState.session,
        ...parsed.session,
        permissions: Array.isArray(parsed.session?.permissions) ? parsed.session.permissions : [],
        isAuthenticated: Boolean(parsed.session?.isAuthenticated),
      },
      auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog.slice(0, MAX_AUDIT_ENTRIES) : [],
    };
  } catch {
    clearPlatformSessionStorage();
    return emptyState;
  }
}

export function writePlatformState(state: PlatformState): void {
  if (typeof globalThis.localStorage === 'undefined' && typeof globalThis.sessionStorage === 'undefined') return;

  const serialized = JSON.stringify(state);
  globalThis.localStorage?.removeItem(PLATFORM_STATE_STORAGE_KEY);
  globalThis.sessionStorage?.removeItem(PLATFORM_STATE_STORAGE_KEY);

  if (!state.session.isAuthenticated) return;

  const targetStorage = state.session.persistenceMode === 'local'
    ? globalThis.localStorage
    : globalThis.sessionStorage;

  targetStorage?.setItem(PLATFORM_STATE_STORAGE_KEY, serialized);
}

export function clearPlatformSessionStorage(): void {
  if (typeof globalThis.localStorage === 'undefined' && typeof globalThis.sessionStorage === 'undefined') return;
  globalThis.localStorage?.removeItem(PLATFORM_STATE_STORAGE_KEY);
  globalThis.sessionStorage?.removeItem(PLATFORM_STATE_STORAGE_KEY);
}

export function createBrandKit(name: string, primaryColor: string): BrandKit {
  return {
    id: createId('brand'),
    name,
    primaryColor,
    secondaryColor: '#0f172a',
    accentColor: primaryColor,
    fontFamily: 'Inter, system-ui, sans-serif',
  };
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

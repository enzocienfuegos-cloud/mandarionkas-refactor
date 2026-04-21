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
  return {
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
}

export function writePlatformState(_state: PlatformState): void {
  // Platform auth now lives on the API via httpOnly cookies.
  // Frontend runtime state is in-memory only.
}

export function clearPlatformSessionStorage(): void {
  // No-op in the new architecture: auth state is not stored in browser storage.
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

import brandingDefaults from '../../config/branding-defaults.json' with { type: 'json' };

function nowIso() {
  return new Date().toISOString();
}

export function createEmptyDb() {
  return {
    users: [],
    clients: [],
    projects: [],
    projectStates: {},
    projectVersions: {},
    projectVersionStates: {},
    documentSlots: {},
    assetFolders: [],
    assets: [],
    sessions: {},
    auditEvents: [],
  };
}

export function normalizeDb(db) {
  const next = db ?? createEmptyDb();
  next.users ??= [];
  next.clients ??= [];
  next.clients = next.clients.map((client) => ({
    ...client,
    brandColor: client.brandColor ?? brandingDefaults.brandColor,
    memberUserIds: Array.from(new Set([client.ownerUserId, ...(client.memberUserIds ?? []), ...((client.members ?? []).map((member) => member.userId))])),
    members: client.members ?? (client.memberUserIds ?? []).map((userId) => ({
      userId,
      role: userId === client.ownerUserId ? 'owner' : 'editor',
      addedAt: nowIso(),
    })),
    invites: client.invites ?? [],
    brands: client.brands ?? [],
  }));
  next.projects ??= [];
  next.projectStates ??= {};
  next.projectVersions ??= {};
  next.projectVersionStates ??= {};
  next.documentSlots ??= {};
  next.assetFolders ??= [];
  next.assets ??= [];
  next.sessions ??= {};
  next.auditEvents ??= [];
  return next;
}

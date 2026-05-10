export function nowIso() {
  return new Date().toISOString();
}

export function isExpired(iso) {
  return !iso || new Date(iso).getTime() <= Date.now();
}

export function stripPassword(user) {
  const { password, ...safe } = user;
  return safe;
}

export function getPermissionsForRole(role) {
  switch (role) {
    case 'admin':
      return ['clients:create', 'clients:update', 'clients:invite', 'clients:manage-members', 'projects:create', 'projects:view-client', 'projects:save', 'projects:delete', 'projects:share-client', 'assets:create', 'assets:view-client', 'assets:update', 'assets:delete', 'assets:manage-client', 'brandkits:manage', 'release:manage'];
    case 'editor':
      return ['projects:create', 'projects:view-client', 'projects:save', 'projects:share-client', 'assets:create', 'assets:view-client', 'assets:update', 'brandkits:manage'];
    default:
      return ['projects:view-client', 'assets:view-client'];
  }
}

export function assertPermission(sessionRecord, permission) {
  if (!sessionRecord.permissions.includes(permission)) {
    throw new Error(`Forbidden: missing ${permission}`);
  }
}

export function hasClientMembership(db, clientId, userId) {
  return db.clients.some((client) => client.id === clientId && client.memberUserIds.includes(userId));
}

export function ensureAuthorizedClient(db, sessionRecord, requestedClientId) {
  const fallbackClientId = sessionRecord.activeClientId;
  const candidateClientId = requestedClientId || fallbackClientId;
  if (!candidateClientId || !hasClientMembership(db, candidateClientId, sessionRecord.user.id)) {
    throw new Error('Forbidden: client access denied');
  }
  return candidateClientId;
}

export function canEditProject(sessionRecord, project) {
  if (sessionRecord.user.role === 'admin') return true;
  if (project.ownerUserId === sessionRecord.user.id) return true;
  return project.accessScope === 'client' && project.clientId === sessionRecord.activeClientId;
}

export function canViewProject(sessionRecord, project) {
  if (sessionRecord.user.role === 'admin') return true;
  if (project.ownerUserId === sessionRecord.user.id) return true;
  return project.clientId === sessionRecord.activeClientId;
}

export function listVisibleClientsForUser(db, user) {
  if (!user) return [];
  if (user.role === 'admin') return db.clients;
  return db.clients.filter((client) => client.memberUserIds.includes(user.id) || client.ownerUserId === user.id);
}

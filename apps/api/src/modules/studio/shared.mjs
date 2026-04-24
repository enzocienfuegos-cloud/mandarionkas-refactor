import { getMember, getUserById, inviteMember } from '@smx/db';
import {
  createStudioClient,
  createStudioBrand,
  createStudioInvite,
  listStudioClientsForUser,
  mapDbRoleToWorkspaceRole,
  mapWorkspaceRoleToDbRole,
} from '@smx/db';
import { memberHasProductAccess } from '@smx/db/team';

const ROLE_PERMISSIONS = {
  owner: [
    'clients:create',
    'clients:update',
    'clients:invite',
    'clients:manage-members',
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:delete',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'assets:delete',
    'assets:manage-client',
    'brandkits:manage',
    'release:manage',
  ],
  editor: [
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'brandkits:manage',
    'clients:invite',
  ],
  reviewer: ['projects:view-client', 'assets:view-client'],
};

export function getStudioRolePermissions(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function deriveStudioRole(dbRole) {
  return mapDbRoleToWorkspaceRole(dbRole);
}

export function getStudioRoleFromAuthSession(authSession) {
  if (!authSession?.role) return 'reviewer';
  return deriveStudioRole(authSession.role);
}

export function hasStudioPermission(authSession, permission, roleOverride = null) {
  if (!authSession?.productAccess?.studio) return false;
  const role = roleOverride ?? getStudioRoleFromAuthSession(authSession);
  return getStudioRolePermissions(role).includes(permission);
}

export async function resolveStudioClientAccess(pool, workspaceId, userId, deps = { getMember }) {
  const member = await deps.getMember(pool, workspaceId, userId);
  if (!member || !memberHasProductAccess(member, 'studio')) return null;
  const role = deriveStudioRole(member.role);
  return {
    member,
    role,
    permissions: getStudioRolePermissions(role),
  };
}

export function canManageStudioClient(authSession) {
  return getStudioRoleFromAuthSession(authSession) === 'owner';
}

export function canInviteStudioMembers(authSession) {
  const role = getStudioRoleFromAuthSession(authSession);
  return role === 'owner' || role === 'editor';
}

export function canWriteStudioProjects(authSession) {
  const role = getStudioRoleFromAuthSession(authSession);
  return role === 'owner' || role === 'editor';
}

export function canDeleteStudioProjects(authSession) {
  return getStudioRoleFromAuthSession(authSession) === 'owner';
}

export function canWriteStudioAssets(authSession) {
  const role = getStudioRoleFromAuthSession(authSession);
  return role === 'owner' || role === 'editor';
}

export function canDeleteStudioAssets(authSession) {
  return getStudioRoleFromAuthSession(authSession) === 'owner';
}

export async function buildStudioSessionPayload(pool, req, { user, workspaceId }) {
  const clients = await listStudioClientsForUser(pool, user.id);
  if (!clients.length) {
    return {
      ok: true,
      authenticated: false,
      reason: 'no_studio_access',
      user: {
        id: user.id,
        name: user.display_name ?? user.email,
        email: user.email,
        role: null,
        avatarUrl: user.avatar_url ?? null,
      },
      activeClientId: null,
      activeWorkspaceId: null,
      clients: [],
      workspaces: [],
      permissions: [],
      session: {
        sessionId: req.session.sessionId ?? req.session.id ?? null,
        persistenceMode: 'session',
        issuedAt: new Date().toISOString(),
        expiresAt: null,
      },
    };
  }
  const activeClientId = workspaceId && clients.some((client) => client.id === workspaceId)
    ? workspaceId
    : clients[0]?.id;
  const activeClient = clients.find((client) => client.id === activeClientId) ?? null;
  const role = activeClient?.currentRole ?? 'reviewer';

  return {
    ok: true,
    authenticated: true,
    user: {
      id: user.id,
      name: user.display_name ?? user.email,
      email: user.email,
      role,
      avatarUrl: user.avatar_url ?? null,
    },
    activeClientId,
    activeWorkspaceId: activeClientId,
    clients: clients.map(({ currentRole, currentProductAccess, ...client }) => client),
    workspaces: clients.map(({ currentRole, currentProductAccess, ...client }) => client),
    permissions: getStudioRolePermissions(role),
    session: {
      sessionId: req.session.sessionId ?? req.session.id ?? null,
      persistenceMode: 'session',
      issuedAt: new Date().toISOString(),
      expiresAt: null,
    },
  };
}

export async function handleCreateStudioClient(pool, userId, name) {
  const workspaceId = await createStudioClient(pool, { userId, name });
  return workspaceId;
}

export async function handleCreateStudioBrand(pool, workspaceId, { name, primaryColor }) {
  await createStudioBrand(pool, {
    workspaceId,
    createdBy: null,
    name,
    primaryColor,
  });
}

export async function handleInviteStudioMember(pool, workspaceId, actorUserId, { email, role }) {
  await inviteMember(pool, workspaceId, {
    email,
    role: mapWorkspaceRoleToDbRole(role),
    invited_by: actorUserId,
  });
  await createStudioInvite(pool, {
    workspaceId,
    email,
    role,
    invitedBy: actorUserId,
  });
}

export async function resolveStudioCurrentUser(pool, userId) {
  return getUserById(pool, userId);
}

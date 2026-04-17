import { randomUUID } from 'node:crypto';
import { authRepository } from '../contracts/auth-repository.mjs';
import { createAuditEvent } from './audit-service.mjs';
import {
  ensureAuthorizedClient,
  getPermissionsForRole,
  isExpired,
  listVisibleClientsForUser,
  nowIso,
  stripPassword,
} from './shared.mjs';

function buildAuditInput(input) {
  return createAuditEvent(input);
}

function createSessionCache({ sessionId, session, user, clients, activeClientId }) {
  return {
    users: [user],
    clients,
    sessions: {
      [sessionId]: {
        ...session,
        activeClientId,
      },
    },
    projects: [],
    projectStates: {},
    projectVersions: {},
    projectVersionStates: {},
    documentSlots: {},
    assetFolders: [],
    assets: [],
    auditEvents: [],
  };
}

export async function authenticate(email, password, remember = false) {
  const user = await authRepository.getUserByEmail(email);
  if (!user || user.password !== password) return null;
  const sessionId = randomUUID();
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + (remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12)).toISOString();
  const clients = await authRepository.listClients();
  const visibleClients = listVisibleClientsForUser({ clients }, user);
  const activeClient = visibleClients.find((client) => client.memberUserIds.includes(user.id)) ?? visibleClients[0] ?? clients[0];
  const session = {
    userId: user.id,
    activeClientId: activeClient?.id,
    issuedAt,
    expiresAt,
    persistenceMode: remember ? 'local' : 'session',
  };
  await authRepository.createSessionRecord(sessionId, session);
  await authRepository.appendAuditEventRecord(buildAuditInput({
    action: 'session.login',
    target: 'session',
    actorUserId: user.id,
    actorName: user.name,
    clientId: activeClient?.id,
    targetId: sessionId,
    summary: `${user.name} signed in`,
  }));
  return {
    ok: true,
    session: {
      sessionId,
      persistenceMode: session.persistenceMode,
      issuedAt,
      expiresAt,
    },
    user: stripPassword(user),
    activeClientId: activeClient?.id,
    permissions: getPermissionsForRole(user.role),
    clients: visibleClients,
  };
}

export async function revokeSession(sessionId) {
  if (!sessionId) return false;
  const session = await authRepository.getSessionRecord(sessionId);
  if (!session) return false;
  const user = session.userId ? await authRepository.getUserById(session.userId) : null;
  const removed = await authRepository.deleteSessionRecord(sessionId);
  if (!removed) return false;
  await authRepository.appendAuditEventRecord(buildAuditInput({
    action: 'session.logout',
    target: 'session',
    actorUserId: user?.id,
    actorName: user?.name,
    clientId: session.activeClientId,
    targetId: sessionId,
    summary: `${user?.name ?? 'User'} signed out`,
  }));
  return true;
}

export async function getSessionContext(sessionId) {
  if (!sessionId) return null;
  const session = await authRepository.getSessionRecord(sessionId);
  if (!session) return null;
  if (isExpired(session.expiresAt)) {
    await authRepository.deleteSessionRecord(sessionId);
    return null;
  }
  const user = await authRepository.getUserById(session.userId);
  if (!user) return null;
  const clients = await authRepository.listClients();
  const visibleClients = listVisibleClientsForUser({ clients }, user);
  const activeClientId = ensureAuthorizedClient({ clients: visibleClients }, { ...session, user }, session.activeClientId);
  return {
    db: createSessionCache({ sessionId, session, user, clients: visibleClients, activeClientId }),
    sessionId,
    activeClientId,
    session,
    user,
    permissions: getPermissionsForRole(user.role),
  };
}

export async function listClientsForSession(sessionRecord) {
  const clients = await authRepository.listClients();
  return listVisibleClientsForUser({ clients }, sessionRecord.user);
}

export async function cleanupExpiredSessions() {
  const removedSessionIds = await authRepository.cleanupExpiredSessionRecords(nowIso());
  return {
    ok: true,
    removedCount: removedSessionIds.length,
    removedSessionIds,
  };
}

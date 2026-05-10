import { randomUUID } from 'node:crypto';
import brandingDefaults from '../../config/branding-defaults.json' with { type: 'json' };
import { clientRepository } from '../contracts/client-repository.mjs';
import { createAuditActor, createAuditEvent } from './audit-service.mjs';
import {
  assertPermission,
  ensureAuthorizedClient,
  hasClientMembership,
  listVisibleClientsForUser,
  nowIso,
} from './shared.mjs';

function buildAuditInput(sessionRecord, input) {
  return createAuditEvent({
    ...input,
    ...createAuditActor(sessionRecord),
  });
}

function syncClientInSession(sessionRecord, client) {
  if (!sessionRecord?.db) return;
  sessionRecord.db.clients ??= [];
  const index = sessionRecord.db.clients.findIndex((entry) => entry.id === client.id);
  if (index >= 0) {
    sessionRecord.db.clients[index] = client;
  } else {
    sessionRecord.db.clients.unshift(client);
  }
}

export async function setActiveClientForSession(sessionRecord, clientId) {
  sessionRecord.db ??= {};
  sessionRecord.db.clients ??= [];
  const nextClientId = ensureAuthorizedClient(sessionRecord.db, sessionRecord, clientId);
  const session = await clientRepository.updateSessionActiveClient(sessionRecord.sessionId, nextClientId);
  if (!session) throw new Error('Session not found');
  sessionRecord.db.sessions ??= {};
  if (sessionRecord.db?.sessions?.[sessionRecord.sessionId]) {
    sessionRecord.db.sessions[sessionRecord.sessionId].activeClientId = nextClientId;
  } else {
    sessionRecord.db.sessions[sessionRecord.sessionId] = {
      ...(sessionRecord.session || {}),
      activeClientId: nextClientId,
    };
  }
  const clients = await clientRepository.listClients();
  return {
    activeClientId: nextClientId,
    clients: listVisibleClientsForUser({ clients }, sessionRecord.user),
  };
}

export async function createClientForSession(sessionRecord, name) {
  assertPermission(sessionRecord, 'clients:create');
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Client name is required');
  const client = {
    id: randomUUID(),
    name: normalizedName,
    slug: normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `client-${(sessionRecord.db?.clients?.length || 0) + 1}`,
    brandColor: brandingDefaults.brandColor,
    ownerUserId: sessionRecord.user.id,
    memberUserIds: [sessionRecord.user.id],
    members: [{ userId: sessionRecord.user.id, role: 'owner', addedAt: nowIso() }],
    invites: [],
    brands: [],
  };
  await clientRepository.upsertClient(client);
  await clientRepository.updateSessionActiveClient(sessionRecord.sessionId, client.id);
  syncClientInSession(sessionRecord, client);
  if (sessionRecord.db?.sessions?.[sessionRecord.sessionId]) {
    sessionRecord.db.sessions[sessionRecord.sessionId].activeClientId = client.id;
  }
  await clientRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'client.create',
    target: 'client',
    clientId: client.id,
    targetId: client.id,
    summary: `${sessionRecord.user.name} created workspace ${client.name}`,
  }));
  const clients = await clientRepository.listClients();
  return {
    client,
    activeClientId: client.id,
    clients: listVisibleClientsForUser({ clients }, sessionRecord.user),
  };
}

export async function addBrandToClientForSession(sessionRecord, clientId, name, primaryColor) {
  assertPermission(sessionRecord, 'brandkits:manage');
  const client = await clientRepository.getClient(clientId);
  if (!client || !hasClientMembership({ clients: [client] }, clientId, sessionRecord.user.id)) {
    throw new Error('Forbidden: client access denied');
  }
  client.brands ??= [];
  const brand = {
    id: randomUUID(),
    name: String(name || '').trim() || brandingDefaults.untitledBrandName,
    primaryColor: primaryColor || brandingDefaults.brandColor,
    secondaryColor: brandingDefaults.secondaryColor,
    accentColor: primaryColor || brandingDefaults.accentColor,
    logoUrl: undefined,
    fontFamily: brandingDefaults.fontFamily,
  };
  client.brands.unshift(brand);
  client.brandColor = client.brandColor || brand.primaryColor;
  await clientRepository.upsertClient(client);
  syncClientInSession(sessionRecord, client);
  await clientRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'brand.create',
    target: 'brand',
    clientId,
    targetId: brand.id,
    summary: `${sessionRecord.user.name} created brand ${brand.name}`,
  }));
  const clients = await clientRepository.listClients();
  return {
    client,
    clients: listVisibleClientsForUser({ clients }, sessionRecord.user),
  };
}

export async function inviteMemberToClientForSession(sessionRecord, clientId, email, role) {
  assertPermission(sessionRecord, 'clients:invite');
  const client = await clientRepository.getClient(clientId);
  if (!client || !hasClientMembership({ clients: [client] }, clientId, sessionRecord.user.id)) {
    throw new Error('Forbidden: client access denied');
  }
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');
  const nextRole = role === 'reviewer' ? 'reviewer' : 'editor';
  const existingUser = await clientRepository.getUserByEmail(normalizedEmail);
  client.invites ??= [];
  client.members ??= [];
  if (existingUser) {
    if (!client.memberUserIds.includes(existingUser.id)) {
      client.memberUserIds.push(existingUser.id);
      client.members.push({ userId: existingUser.id, role: nextRole, addedAt: nowIso() });
    } else {
      client.members = client.members.map((member) => member.userId === existingUser.id ? { ...member, role: nextRole } : member);
    }
    await clientRepository.upsertClient(client);
    syncClientInSession(sessionRecord, client);
    await clientRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
      action: 'client.member.invite',
      target: 'member',
      clientId,
      targetId: existingUser.id,
      summary: `${sessionRecord.user.name} added ${existingUser.email} to ${client.name} as ${nextRole}`,
    }));
    const clients = await clientRepository.listClients();
    return {
      ok: true,
      message: 'User added to workspace.',
      client,
      clients: listVisibleClientsForUser({ clients }, sessionRecord.user),
    };
  }
  const existingInvite = client.invites.find((invite) => invite.email.toLowerCase() === normalizedEmail);
  if (existingInvite) {
    existingInvite.role = nextRole;
  } else {
    client.invites.push({
      id: randomUUID(),
      email: normalizedEmail,
      role: nextRole,
      status: 'pending',
      invitedAt: nowIso(),
    });
  }
  await clientRepository.upsertClient(client);
  syncClientInSession(sessionRecord, client);
  await clientRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'client.member.invite',
    target: 'member',
    clientId,
    targetId: normalizedEmail,
    summary: `${sessionRecord.user.name} invited ${normalizedEmail} to ${client.name} as ${nextRole}`,
  }));
  const clients = await clientRepository.listClients();
  return {
    ok: true,
    message: 'Invite created.',
    client,
    clients: listVisibleClientsForUser({ clients }, sessionRecord.user),
  };
}

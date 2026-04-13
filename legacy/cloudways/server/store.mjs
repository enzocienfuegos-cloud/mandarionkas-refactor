import { randomUUID } from 'node:crypto';
import { getServerEnv } from './env.mjs';
import { deleteObject, listObjectKeys, readJsonObject, writeJsonObject } from './r2.mjs';

const env = getServerEnv();
const legacyDataKey = env.dataKey;

function deriveDataPrefix() {
  const explicit = String(env.dataPrefix || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const normalizedLegacyKey = String(legacyDataKey || 'platform-api/store.json').trim().replace(/\/+$/, '');
  if (normalizedLegacyKey.endsWith('/store.json')) {
    return normalizedLegacyKey.slice(0, -'/store.json'.length) || 'platform-api';
  }
  const lastSlashIndex = normalizedLegacyKey.lastIndexOf('/');
  if (lastSlashIndex > 0) return normalizedLegacyKey.slice(0, lastSlashIndex);
  return 'platform-api';
}

const dataPrefix = deriveDataPrefix();
const dataKeys = {
  users: `${dataPrefix}/users.json`,
  clients: `${dataPrefix}/clients.json`,
  projects: `${dataPrefix}/projects.json`,
  projectStates: `${dataPrefix}/project-states.json`,
  projectVersions: `${dataPrefix}/project-versions.json`,
  projectVersionStates: `${dataPrefix}/project-version-states.json`,
  documentSlots: `${dataPrefix}/document-slots.json`,
  assetFolders: `${dataPrefix}/asset-folders.json`,
  assets: `${dataPrefix}/assets.json`,
  sessions: `${dataPrefix}/sessions.json`,
};

const entityPrefixes = {
  clients: `${dataPrefix}/entities/clients`,
  projects: `${dataPrefix}/entities/projects`,
  projectStates: `${dataPrefix}/entities/project-states`,
  projectVersions: `${dataPrefix}/entities/project-versions`,
  projectVersionStates: `${dataPrefix}/entities/project-version-states`,
  assetFolders: `${dataPrefix}/entities/asset-folders`,
  assets: `${dataPrefix}/entities/assets`,
};

function nowIso() {
  return new Date().toISOString();
}

function isExpired(iso) {
  return !iso || new Date(iso).getTime() <= Date.now();
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildEntityKey(prefix, id) {
  return `${prefix}/${id}.json`;
}

async function readEntityCollection(prefix) {
  const keys = await listObjectKeys(`${prefix}/`);
  if (!keys.length) return [];
  const items = await Promise.all(keys.map((key) => readJsonObject(key)));
  return items.filter((item) => isRecord(item));
}

async function readEntityRecord(prefix, id) {
  return readJsonObject(buildEntityKey(prefix, id));
}

async function writeEntityRecord(prefix, id, value) {
  await writeJsonObject(buildEntityKey(prefix, id), value);
}

async function deleteEntityRecord(prefix, id) {
  await deleteObject(buildEntityKey(prefix, id));
}

async function hydrateDbFromEntitySidecars(db) {
  const [clients, projects, projectStates, projectVersions, projectVersionStates, assetFolders, assets] = await Promise.all([
    readEntityCollection(entityPrefixes.clients),
    readEntityCollection(entityPrefixes.projects),
    readEntityCollection(entityPrefixes.projectStates),
    readEntityCollection(entityPrefixes.projectVersions),
    readEntityCollection(entityPrefixes.projectVersionStates),
    readEntityCollection(entityPrefixes.assetFolders),
    readEntityCollection(entityPrefixes.assets),
  ]);

  if (clients.length) {
    const map = new Map(db.clients.map((client) => [client.id, client]));
    for (const client of clients) map.set(client.id, { ...map.get(client.id), ...client });
    db.clients = Array.from(map.values());
  }

  if (projects.length) {
    const map = new Map(db.projects.map((project) => [project.id, project]));
    for (const project of projects) map.set(project.id, { ...map.get(project.id), ...project });
    db.projects = Array.from(map.values())
      .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
  }

  if (projectStates.length) {
    for (const entry of projectStates) {
      if (typeof entry.projectId === 'string' && entry.state && typeof entry.state === 'object') {
        db.projectStates[entry.projectId] = entry.state;
      }
    }
  }

  if (projectVersions.length) {
    const nextProjectVersions = { ...(db.projectVersions || {}) };
    for (const entry of projectVersions) {
      if (!isRecord(entry) || typeof entry.projectId !== 'string' || typeof entry.id !== 'string') continue;
      const current = nextProjectVersions[entry.projectId] ?? [];
      const withoutCurrent = current.filter((version) => version.id !== entry.id);
      nextProjectVersions[entry.projectId] = [...withoutCurrent, entry].sort((left, right) => {
        const leftOrder = typeof left.versionNumber === 'number' ? left.versionNumber : 0;
        const rightOrder = typeof right.versionNumber === 'number' ? right.versionNumber : 0;
        return rightOrder - leftOrder;
      });
    }
    db.projectVersions = nextProjectVersions;
  }

  if (projectVersionStates.length) {
    for (const entry of projectVersionStates) {
      if (typeof entry.versionId === 'string' && entry.state && typeof entry.state === 'object') {
        db.projectVersionStates[entry.versionId] = entry.state;
      }
    }
  }

  if (assetFolders.length) {
    const map = new Map(db.assetFolders.map((folder) => [folder.id, folder]));
    for (const folder of assetFolders) map.set(folder.id, { ...map.get(folder.id), ...folder });
    db.assetFolders = Array.from(map.values())
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  }

  if (assets.length) {
    const map = new Map(db.assets.map((asset) => [asset.id, asset]));
    for (const asset of assets) map.set(asset.id, { ...map.get(asset.id), ...asset });
    db.assets = Array.from(map.values())
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  }

  return db;
}

async function backfillEntitySidecars(db) {
  await Promise.all([
    ...db.clients.map((client) => writeEntityRecord(entityPrefixes.clients, client.id, client)),
    ...db.projects.map((project) => writeEntityRecord(entityPrefixes.projects, project.id, project)),
    ...Object.values(db.projectVersions)
      .flatMap((versions) => (Array.isArray(versions) ? versions : []))
      .map((version) => writeEntityRecord(entityPrefixes.projectVersions, version.id, version)),
    ...Object.entries(db.projectVersionStates).map(([versionId, state]) => writeEntityRecord(entityPrefixes.projectVersionStates, versionId, { versionId, state })),
    ...db.assetFolders.map((folder) => writeEntityRecord(entityPrefixes.assetFolders, folder.id, folder)),
    ...db.assets.map((asset) => writeEntityRecord(entityPrefixes.assets, asset.id, asset)),
    ...Object.entries(db.projectStates).map(([projectId, state]) => writeEntityRecord(entityPrefixes.projectStates, projectId, { projectId, state })),
  ]);
}

function hasClientMembership(db, clientId, userId) {
  return db.clients.some((client) => client.id === clientId && client.memberUserIds.includes(userId));
}

function ensureAuthorizedClient(db, sessionRecord, requestedClientId) {
  const fallbackClientId = sessionRecord.activeClientId;
  const candidateClientId = requestedClientId || fallbackClientId;
  if (!candidateClientId || !hasClientMembership(db, candidateClientId, sessionRecord.user.id)) {
    throw new Error('Forbidden: client access denied');
  }
  return candidateClientId;
}

function canEditProject(sessionRecord, project) {
  if (sessionRecord.user.role === 'admin') return true;
  if (project.ownerUserId === sessionRecord.user.id) return true;
  return project.accessScope === 'client' && project.clientId === sessionRecord.activeClientId;
}

function canViewProject(sessionRecord, project) {
  if (sessionRecord.user.role === 'admin') return true;
  if (project.ownerUserId === sessionRecord.user.id) return true;
  return project.clientId === sessionRecord.activeClientId;
}

function canViewAsset(sessionRecord, asset) {
  if (sessionRecord.user.role === 'admin') return true;
  if (asset.ownerUserId === sessionRecord.user.id) return true;
  return asset.clientId === sessionRecord.activeClientId && asset.accessScope !== 'private';
}

function canEditAsset(sessionRecord, asset) {
  if (sessionRecord.user.role === 'admin') return true;
  if (asset.ownerUserId === sessionRecord.user.id) return true;
  return asset.clientId === sessionRecord.activeClientId && sessionRecord.user.role === 'editor';
}

function getDocumentSlotKey(sessionRecord, scope = 'autosave', projectId = '') {
  const normalizedProjectId = String(projectId || '').trim() || 'workspace';
  return `${scope}:${sessionRecord.activeClientId || 'client_default'}:${sessionRecord.user.id}:${normalizedProjectId}`;
}

function assertPermission(sessionRecord, permission) {
  if (!sessionRecord.permissions.includes(permission)) {
    throw new Error(`Forbidden: missing ${permission}`);
  }
}

function createSeed() {
  const adminId = 'usr_admin';
  const editorId = 'usr_editor';
  const reviewerId = 'usr_reviewer';
  const defaultClientId = 'client_default';
  return {
    users: [
      { id: adminId, name: 'SMX Admin', email: 'admin@smx.studio', password: 'demo123', role: 'admin' },
      { id: editorId, name: 'Client Editor', email: 'editor@smx.studio', password: 'demo123', role: 'editor' },
      { id: reviewerId, name: 'Client Reviewer', email: 'reviewer@smx.studio', password: 'demo123', role: 'reviewer' },
    ],
    clients: [
      {
        id: defaultClientId,
        name: 'Default Client',
        slug: 'default-client',
        brandColor: '#8b5cf6',
        ownerUserId: adminId,
        memberUserIds: [adminId, editorId, reviewerId],
        members: [
          { userId: adminId, role: 'owner', addedAt: nowIso() },
          { userId: editorId, role: 'editor', addedAt: nowIso() },
          { userId: reviewerId, role: 'reviewer', addedAt: nowIso() },
        ],
        invites: [],
        brands: [
          {
            id: randomUUID(),
            name: 'Primary Brand',
            primaryColor: '#8b5cf6',
            secondaryColor: '#0f172a',
            accentColor: '#ec4899',
            logoUrl: undefined,
            fontFamily: 'Inter, system-ui, sans-serif',
          },
        ],
      },
    ],
    projects: [],
    projectStates: {},
    projectVersions: {},
    projectVersionStates: {},
    documentSlots: {},
    assetFolders: [],
    assets: [],
    sessions: {},
  };
}

function normalizeDb(db) {
  const next = db ?? createSeed();
  next.users ??= [];
  next.clients ??= [];
  next.clients = next.clients.map((client) => ({
    ...client,
    brandColor: client.brandColor ?? '#8b5cf6',
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
  return next;
}

async function readSplitDb() {
  const [
    users,
    clients,
    projects,
    projectStates,
    projectVersions,
    projectVersionStates,
    documentSlots,
    assetFolders,
    assets,
    sessions,
  ] = await Promise.all([
    readJsonObject(dataKeys.users),
    readJsonObject(dataKeys.clients),
    readJsonObject(dataKeys.projects),
    readJsonObject(dataKeys.projectStates),
    readJsonObject(dataKeys.projectVersions),
    readJsonObject(dataKeys.projectVersionStates),
    readJsonObject(dataKeys.documentSlots),
    readJsonObject(dataKeys.assetFolders),
    readJsonObject(dataKeys.assets),
    readJsonObject(dataKeys.sessions),
  ]);

  const hasAnyData = [users, clients, projects, projectStates, projectVersions, projectVersionStates, documentSlots, assetFolders, assets, sessions]
    .some((entry) => entry !== null);

  if (!hasAnyData) return null;

  return normalizeDb({
    users: Array.isArray(users) ? users : [],
    clients: Array.isArray(clients) ? clients : [],
    projects: Array.isArray(projects) ? projects : [],
    projectStates: isRecord(projectStates) ? projectStates : {},
    projectVersions: isRecord(projectVersions) ? projectVersions : {},
    projectVersionStates: isRecord(projectVersionStates) ? projectVersionStates : {},
    documentSlots: isRecord(documentSlots) ? documentSlots : {},
    assetFolders: Array.isArray(assetFolders) ? assetFolders : [],
    assets: Array.isArray(assets) ? assets : [],
    sessions: isRecord(sessions) ? sessions : {},
  });
}

async function writeSplitDb(db) {
  await Promise.all([
    writeJsonObject(dataKeys.users, db.users),
    writeJsonObject(dataKeys.clients, db.clients),
    writeJsonObject(dataKeys.projects, db.projects),
    writeJsonObject(dataKeys.projectStates, db.projectStates),
    writeJsonObject(dataKeys.projectVersions, db.projectVersions),
    writeJsonObject(dataKeys.projectVersionStates, db.projectVersionStates),
    writeJsonObject(dataKeys.documentSlots, db.documentSlots),
    writeJsonObject(dataKeys.assetFolders, db.assetFolders),
    writeJsonObject(dataKeys.assets, db.assets),
    writeJsonObject(dataKeys.sessions, db.sessions),
  ]);
}

async function ensureDataFile() {
  const split = await readSplitDb();
  if (split) {
    const hydrated = await hydrateDbFromEntitySidecars(split);
    await backfillEntitySidecars(hydrated);
    return hydrated;
  }

  const legacy = await readJsonObject(legacyDataKey);
  if (legacy) {
    const migrated = normalizeDb(legacy);
    await writeSplitDb(migrated);
    const hydrated = await hydrateDbFromEntitySidecars(migrated);
    await backfillEntitySidecars(hydrated);
    return hydrated;
  }

  const seed = normalizeDb(createSeed());
  await writeSplitDb(seed);
  await writeJsonObject(legacyDataKey, seed);
  await backfillEntitySidecars(seed);
  return seed;
}

export async function readDb() {
  const db = await ensureDataFile();
  db.users ??= [];
  db.clients ??= [];
  db.clients = db.clients.map((client) => ({
    ...client,
    brandColor: client.brandColor ?? '#8b5cf6',
    memberUserIds: Array.from(new Set([client.ownerUserId, ...(client.memberUserIds ?? []), ...((client.members ?? []).map((member) => member.userId))])),
    members: client.members ?? (client.memberUserIds ?? []).map((userId) => ({
      userId,
      role: userId === client.ownerUserId ? 'owner' : 'editor',
      addedAt: nowIso(),
    })),
    invites: client.invites ?? [],
    brands: client.brands ?? [],
  }));
  db.projects ??= [];
  db.projectStates ??= {};
  db.projectVersions ??= {};
  db.projectVersionStates ??= {};
  db.documentSlots ??= {};
  db.assetFolders ??= [];
  db.assets ??= [];
  db.sessions ??= {};
  return db;
}

export async function writeDb(db) {
  const normalized = normalizeDb(db);
  await writeSplitDb(normalized);
  await writeJsonObject(legacyDataKey, normalized);
  await backfillEntitySidecars(normalized);
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

function listVisibleClientsForUser(db, user) {
  if (!user) return [];
  if (user.role === 'admin') return db.clients;
  return db.clients.filter((client) => client.memberUserIds.includes(user.id) || client.ownerUserId === user.id);
}

export async function authenticate(email, password, remember = false) {
  const db = await readDb();
  const user = db.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase() && entry.password === password);
  if (!user) return null;
  const sessionId = randomUUID();
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + (remember ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 12)).toISOString();
  const visibleClients = listVisibleClientsForUser(db, user);
  const activeClient = visibleClients.find((client) => client.memberUserIds.includes(user.id)) ?? visibleClients[0] ?? db.clients[0];
  db.sessions[sessionId] = { userId: user.id, activeClientId: activeClient?.id, issuedAt, expiresAt, persistenceMode: remember ? 'local' : 'session' };
  await writeDb(db);
  return {
    ok: true,
    session: {
      sessionId,
      persistenceMode: remember ? 'local' : 'session',
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
  const db = await readDb();
  if (!db.sessions[sessionId]) return false;
  delete db.sessions[sessionId];
  await writeDb(db);
  return true;
}

export async function getSessionContext(sessionId) {
  if (!sessionId) return null;
  const db = await readDb();
  const session = db.sessions[sessionId];
  if (!session) return null;
  if (isExpired(session.expiresAt)) {
    delete db.sessions[sessionId];
    await writeDb(db);
    return null;
  }
  const user = db.users.find((entry) => entry.id === session.userId);
  if (!user) return null;
  const activeClientId = ensureAuthorizedClient(db, { ...session, user }, session.activeClientId);
  return {
    db,
    sessionId,
    activeClientId,
    session,
    user,
    permissions: getPermissionsForRole(user.role),
  };
}

export async function listClientsForSession(sessionRecord) {
  return listVisibleClientsForUser(sessionRecord.db, sessionRecord.user);
}

export async function setActiveClientForSession(sessionRecord, clientId) {
  const { db, sessionId } = sessionRecord;
  const nextClientId = ensureAuthorizedClient(db, sessionRecord, clientId);
  if (!db.sessions[sessionId]) throw new Error('Session not found');
  db.sessions[sessionId].activeClientId = nextClientId;
  await writeDb(db);
  return {
    activeClientId: nextClientId,
    clients: listVisibleClientsForUser(db, sessionRecord.user),
  };
}

export async function createClientForSession(sessionRecord, name) {
  assertPermission(sessionRecord, 'clients:create');
  const { db, sessionId } = sessionRecord;
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Client name is required');
  const client = {
    id: randomUUID(),
    name: normalizedName,
    slug: normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `client-${db.clients.length + 1}`,
    brandColor: '#8b5cf6',
    ownerUserId: sessionRecord.user.id,
    memberUserIds: [sessionRecord.user.id],
    members: [{ userId: sessionRecord.user.id, role: 'owner', addedAt: nowIso() }],
    invites: [],
    brands: [],
  };
  db.clients.unshift(client);
  if (db.sessions[sessionId]) db.sessions[sessionId].activeClientId = client.id;
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.clients, client.id, client);
  return {
    client,
    activeClientId: client.id,
    clients: listVisibleClientsForUser(db, sessionRecord.user),
  };
}

export async function addBrandToClientForSession(sessionRecord, clientId, name, primaryColor) {
  assertPermission(sessionRecord, 'brandkits:manage');
  const { db } = sessionRecord;
  const client = db.clients.find((entry) => entry.id === clientId);
  if (!client || !hasClientMembership(db, clientId, sessionRecord.user.id)) {
    throw new Error('Forbidden: client access denied');
  }
  client.brands ??= [];
  const brand = {
    id: randomUUID(),
    name: String(name || '').trim() || 'Untitled Brand',
    primaryColor: primaryColor || '#8b5cf6',
    secondaryColor: '#0f172a',
    accentColor: primaryColor || '#8b5cf6',
    logoUrl: undefined,
    fontFamily: 'Inter, system-ui, sans-serif',
  };
  client.brands.unshift(brand);
  client.brandColor = client.brandColor || brand.primaryColor;
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.clients, client.id, client);
  return {
    client,
    clients: listVisibleClientsForUser(db, sessionRecord.user),
  };
}

export async function inviteMemberToClientForSession(sessionRecord, clientId, email, role) {
  assertPermission(sessionRecord, 'clients:invite');
  const { db } = sessionRecord;
  const client = db.clients.find((entry) => entry.id === clientId);
  if (!client || !hasClientMembership(db, clientId, sessionRecord.user.id)) {
    throw new Error('Forbidden: client access denied');
  }
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');
  const nextRole = role === 'reviewer' ? 'reviewer' : 'editor';
  const existingUser = db.users.find((user) => user.email.toLowerCase() === normalizedEmail);
  client.invites ??= [];
  client.members ??= [];
  if (existingUser) {
    if (!client.memberUserIds.includes(existingUser.id)) {
      client.memberUserIds.push(existingUser.id);
      client.members.push({ userId: existingUser.id, role: nextRole, addedAt: nowIso() });
    } else {
      client.members = client.members.map((member) => member.userId === existingUser.id ? { ...member, role: nextRole } : member);
    }
    await writeDb(db);
    await writeEntityRecord(entityPrefixes.clients, client.id, client);
    return {
      ok: true,
      message: 'User added to workspace.',
      client,
      clients: listVisibleClientsForUser(db, sessionRecord.user),
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
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.clients, client.id, client);
  return {
    ok: true,
    message: 'Invite created.',
    client,
    clients: listVisibleClientsForUser(db, sessionRecord.user),
  };
}

export async function listProjectsForSession(sessionRecord) {
  assertPermission(sessionRecord, 'projects:view-client');
  const { db } = sessionRecord;
  return db.projects.filter((project) => canViewProject(sessionRecord, project));
}

export async function saveProjectForSession(sessionRecord, state, projectId) {
  assertPermission(sessionRecord, 'projects:save');
  const { db } = sessionRecord;
  const now = nowIso();
  const existing = db.projects.find((project) => project.id === projectId);
  if (existing) {
    if (!canEditProject(sessionRecord, existing)) throw new Error('Forbidden: cannot edit project');
    existing.updatedAt = now;
    existing.name = state?.document?.name || existing.name;
    existing.brandId = state?.document?.metadata?.platform?.brandId;
    existing.brandName = state?.document?.metadata?.platform?.brandName;
    existing.campaignName = state?.document?.metadata?.platform?.campaignName;
    existing.canvasPresetId = state?.document?.canvas?.presetId;
    existing.sceneCount = Array.isArray(state?.document?.scenes) ? state.document.scenes.length : existing.sceneCount;
    existing.widgetCount = Array.isArray(state?.document?.scenes) ? state.document.scenes.reduce((count, scene) => count + (scene.widgetIds?.length || 0), 0) : existing.widgetCount;
    db.projectStates[existing.id] = state;
    await writeDb(db);
    await Promise.all([
      writeEntityRecord(entityPrefixes.projects, existing.id, existing),
      writeEntityRecord(entityPrefixes.projectStates, existing.id, { projectId: existing.id, state }),
    ]);
    return existing;
  }
  assertPermission(sessionRecord, 'projects:create');
  const project = {
    id: randomUUID(),
    name: state?.document?.name || `Untitled Project ${db.projects.length + 1}`,
    updatedAt: now,
    clientId: sessionRecord.activeClientId,
    ownerUserId: sessionRecord.user.id,
    ownerName: sessionRecord.user.name,
    brandId: state?.document?.metadata?.platform?.brandId,
    brandName: state?.document?.metadata?.platform?.brandName,
    campaignName: state?.document?.metadata?.platform?.campaignName,
    accessScope: state?.document?.metadata?.platform?.accessScope || 'client',
    canvasPresetId: state?.document?.canvas?.presetId,
    sceneCount: Array.isArray(state?.document?.scenes) ? state.document.scenes.length : 1,
    widgetCount: Array.isArray(state?.document?.scenes) ? state.document.scenes.reduce((count, scene) => count + (scene.widgetIds?.length || 0), 0) : 0,
    archivedAt: undefined,
  };
  db.projects.unshift(project);
  db.projectStates[project.id] = state;
  await writeDb(db);
  await Promise.all([
    writeEntityRecord(entityPrefixes.projects, project.id, project),
    writeEntityRecord(entityPrefixes.projectStates, project.id, { projectId: project.id, state }),
  ]);
  return project;
}

export async function loadProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:view-client');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canViewProject(sessionRecord, project)) return null;
  return db.projectStates[projectId] ?? null;
}

export async function deleteProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:delete');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot delete project');
  const versions = db.projectVersions[projectId] ?? [];
  db.projects = db.projects.filter((entry) => entry.id !== projectId);
  delete db.projectStates[projectId];
  delete db.projectVersions[projectId];
  for (const version of versions) {
    delete db.projectVersionStates[version.id];
  }
  await writeDb(db);
  await Promise.all([
    deleteEntityRecord(entityPrefixes.projects, projectId),
    deleteEntityRecord(entityPrefixes.projectStates, projectId),
    ...versions.map((version) => deleteEntityRecord(entityPrefixes.projectVersions, version.id)),
    ...versions.map((version) => deleteEntityRecord(entityPrefixes.projectVersionStates, version.id)),
  ]);
}

export async function listProjectVersionsForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:view-client');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canViewProject(sessionRecord, project)) return [];
  return db.projectVersions[projectId] ?? [];
}

export async function saveProjectVersionForSession(sessionRecord, projectId, state, note) {
  assertPermission(sessionRecord, 'projects:save');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project) throw new Error('Project not found');
  if (!canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot version project');
  const versions = db.projectVersions[projectId] ?? [];
  const version = {
    id: randomUUID(),
    projectId,
    projectName: project.name,
    versionNumber: versions.length + 1,
    savedAt: nowIso(),
    note,
  };
  db.projectVersions[projectId] = [version, ...versions];
  db.projectVersionStates[version.id] = state;
  project.updatedAt = version.savedAt;
  await writeDb(db);
  await Promise.all([
    writeEntityRecord(entityPrefixes.projectVersions, version.id, version),
    writeEntityRecord(entityPrefixes.projectVersionStates, version.id, { versionId: version.id, state }),
    writeEntityRecord(entityPrefixes.projects, project.id, project),
  ]);
  return version;
}

export async function loadProjectVersionForSession(sessionRecord, projectId, versionId) {
  assertPermission(sessionRecord, 'projects:view-client');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canViewProject(sessionRecord, project)) return null;
  const versions = db.projectVersions[projectId] ?? [];
  if (!versions.some((entry) => entry.id === versionId)) return null;
  return db.projectVersionStates[versionId] ?? null;
}

export async function listAssetsForSession(sessionRecord) {
  assertPermission(sessionRecord, 'assets:view-client');
  return sessionRecord.db.assets.filter((asset) => canViewAsset(sessionRecord, asset));
}

export async function listAssetFoldersForSession(sessionRecord) {
  assertPermission(sessionRecord, 'assets:view-client');
  return sessionRecord.db.assetFolders.filter((folder) => {
    return folder.clientId === sessionRecord.activeClientId && (
      sessionRecord.user.role === 'admin' ||
      folder.ownerUserId === sessionRecord.user.id ||
      sessionRecord.user.role === 'editor'
    );
  });
}

export async function createAssetFolderForSession(sessionRecord, name, parentId) {
  assertPermission(sessionRecord, 'assets:create');
  const { db } = sessionRecord;
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Folder name is required');
  const normalizedParentId = typeof parentId === 'string' && parentId.trim() ? parentId.trim() : undefined;
  if (normalizedParentId) {
    const parentFolder = db.assetFolders.find((folder) => folder.id === normalizedParentId);
    if (!parentFolder) throw new Error('Parent folder not found');
    if (parentFolder.clientId !== sessionRecord.activeClientId) throw new Error('Forbidden: parent folder access denied');
  }
  const folder = {
    id: randomUUID(),
    name: normalizedName,
    createdAt: nowIso(),
    clientId: sessionRecord.activeClientId,
    ownerUserId: sessionRecord.user.id,
    parentId: normalizedParentId,
  };
  db.assetFolders.unshift(folder);
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.assetFolders, folder.id, folder);
  return folder;
}

export async function saveAssetForSession(sessionRecord, asset) {
  assertPermission(sessionRecord, 'assets:create');
  const { db } = sessionRecord;
  const normalized = {
    ...asset,
    clientId: sessionRecord.activeClientId,
    ownerUserId: sessionRecord.user.id,
  };
  db.assets.unshift(normalized);
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.assets, normalized.id, normalized);
  return normalized;
}

export async function getAssetForSession(sessionRecord, assetId) {
  assertPermission(sessionRecord, 'assets:view-client');
  const asset = sessionRecord.db.assets.find((entry) => entry.id === assetId);
  if (!asset || !canViewAsset(sessionRecord, asset)) return undefined;
  return asset;
}

export async function renameAssetForSession(sessionRecord, assetId, name) {
  assertPermission(sessionRecord, 'assets:update');
  const { db } = sessionRecord;
  const asset = db.assets.find((entry) => entry.id === assetId);
  if (!asset) return undefined;
  if (!canEditAsset(sessionRecord, asset)) throw new Error('Forbidden: cannot rename asset');
  asset.name = name || asset.name;
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.assets, asset.id, asset);
  return asset;
}

export async function deleteAssetForSession(sessionRecord, assetId, options = {}) {
  assertPermission(sessionRecord, 'assets:delete');
  const { db } = sessionRecord;
  const asset = db.assets.find((entry) => entry.id === assetId);
  if (!asset) return false;
  if (!canEditAsset(sessionRecord, asset)) throw new Error('Forbidden: cannot delete asset');
  db.assets = db.assets.filter((entry) => entry.id !== assetId);
  await writeDb(db);
  await Promise.all([
    deleteEntityRecord(entityPrefixes.assets, assetId),
    options?.purgeBinary && asset.storageKey ? deleteObject(asset.storageKey) : Promise.resolve(),
  ]);
  return true;
}

export async function duplicateProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:view-client');
  assertPermission(sessionRecord, 'projects:create');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canViewProject(sessionRecord, project)) throw new Error('Project not found');
  const state = db.projectStates[projectId];
  if (!state) throw new Error('Project state missing');
  const duplicateId = randomUUID();
  const duplicatedState = JSON.parse(JSON.stringify(state));
  duplicatedState.document = duplicatedState.document || {};
  duplicatedState.document.id = duplicateId;
  duplicatedState.document.name = `${project.name} Copy`;
  duplicatedState.document.metadata = { ...(duplicatedState.document.metadata || {}), dirty: false, lastSavedAt: nowIso() };
  duplicatedState.ui = { ...(duplicatedState.ui || {}), activeProjectId: duplicateId };
  const duplicate = {
    ...project,
    id: duplicateId,
    name: `${project.name} Copy`,
    ownerUserId: sessionRecord.user.id,
    ownerName: sessionRecord.user.name,
    updatedAt: nowIso(),
    archivedAt: undefined,
  };
  db.projects.unshift(duplicate);
  db.projectStates[duplicateId] = duplicatedState;
  await writeDb(db);
  await Promise.all([
    writeEntityRecord(entityPrefixes.projects, duplicateId, duplicate),
    writeEntityRecord(entityPrefixes.projectStates, duplicateId, { projectId: duplicateId, state: duplicatedState }),
  ]);
  return duplicate;
}

export async function archiveProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:delete');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot archive project');
  project.archivedAt = nowIso();
  project.updatedAt = nowIso();
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.projects, project.id, project);
}

export async function restoreProjectForSession(sessionRecord, projectId) {
  assertPermission(sessionRecord, 'projects:delete');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot restore project');
  project.archivedAt = undefined;
  project.updatedAt = nowIso();
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.projects, project.id, project);
}

export async function changeProjectOwnerForSession(sessionRecord, projectId, ownerUserId, ownerName) {
  assertPermission(sessionRecord, 'projects:delete');
  const { db } = sessionRecord;
  const project = db.projects.find((entry) => entry.id === projectId);
  if (!project || !canEditProject(sessionRecord, project)) throw new Error('Forbidden: cannot change owner');
  const client = db.clients.find((entry) => entry.id === project.clientId);
  if (!client || !client.memberUserIds.includes(ownerUserId)) throw new Error('Forbidden: owner must belong to client');
  project.ownerUserId = ownerUserId;
  project.ownerName = ownerName || db.users.find((user) => user.id === ownerUserId)?.name || ownerUserId;
  project.updatedAt = nowIso();
  await writeDb(db);
  await writeEntityRecord(entityPrefixes.projects, project.id, project);
}

export async function getStorageDiagnosticsForSession(sessionRecord) {
  if (sessionRecord.user.role !== 'admin') throw new Error('Forbidden: diagnostics require admin access');
  const db = await readDb();
  const [
    clientSidecars,
    projectSidecars,
    projectStateSidecars,
    projectVersionSidecars,
    projectVersionStateSidecars,
    assetFolderSidecars,
    assetSidecars,
    binaryKeys,
    legacyStore,
  ] = await Promise.all([
    readEntityCollection(entityPrefixes.clients),
    readEntityCollection(entityPrefixes.projects),
    readEntityCollection(entityPrefixes.projectStates),
    readEntityCollection(entityPrefixes.projectVersions),
    readEntityCollection(entityPrefixes.projectVersionStates),
    readEntityCollection(entityPrefixes.assetFolders),
    readEntityCollection(entityPrefixes.assets),
    listObjectKeys('workspaces/'),
    readJsonObject(legacyDataKey),
  ]);

  const dbAssetIds = new Set(db.assets.map((asset) => asset.id));
  const sidecarAssetIds = new Set(assetSidecars.map((asset) => asset.id).filter(Boolean));
  const dbProjectIds = new Set(db.projects.map((project) => project.id));
  const sidecarProjectIds = new Set(projectSidecars.map((project) => project.id).filter(Boolean));
  const dbClientIds = new Set(db.clients.map((client) => client.id));
  const sidecarClientIds = new Set(clientSidecars.map((client) => client.id).filter(Boolean));
  const dbProjectStateIds = new Set(Object.keys(db.projectStates || {}));
  const sidecarProjectStateIds = new Set(projectStateSidecars.map((entry) => entry.projectId).filter(Boolean));
  const dbVersionIds = new Set(Object.values(db.projectVersions || {}).flatMap((versions) => Array.isArray(versions) ? versions.map((version) => version.id) : []));
  const sidecarVersionIds = new Set(projectVersionSidecars.map((version) => version.id).filter(Boolean));
  const dbVersionStateIds = new Set(Object.keys(db.projectVersionStates || {}));
  const sidecarVersionStateIds = new Set(projectVersionStateSidecars.map((entry) => entry.versionId).filter(Boolean));
  const binaryKeySet = new Set(binaryKeys);

  const issues = {
    indexedClientsMissingSidecar: db.clients.filter((client) => !sidecarClientIds.has(client.id)).map((client) => client.id),
    clientSidecarsMissingIndex: clientSidecars.filter((client) => !dbClientIds.has(client.id)).map((client) => client.id),
    indexedProjectsMissingSidecar: db.projects.filter((project) => !sidecarProjectIds.has(project.id)).map((project) => project.id),
    projectSidecarsMissingIndex: projectSidecars.filter((project) => !dbProjectIds.has(project.id)).map((project) => project.id),
    indexedProjectStatesMissingSidecar: Array.from(dbProjectStateIds).filter((projectId) => !sidecarProjectStateIds.has(projectId)),
    projectStateSidecarsMissingIndex: projectStateSidecars.filter((entry) => !dbProjectStateIds.has(entry.projectId)).map((entry) => entry.projectId),
    indexedVersionsMissingSidecar: Array.from(dbVersionIds).filter((versionId) => !sidecarVersionIds.has(versionId)),
    versionSidecarsMissingIndex: projectVersionSidecars.filter((version) => !dbVersionIds.has(version.id)).map((version) => version.id),
    indexedVersionStatesMissingSidecar: Array.from(dbVersionStateIds).filter((versionId) => !sidecarVersionStateIds.has(versionId)),
    versionStateSidecarsMissingIndex: projectVersionStateSidecars.filter((entry) => !dbVersionStateIds.has(entry.versionId)).map((entry) => entry.versionId),
    indexedAssetsMissingSidecar: db.assets.filter((asset) => !sidecarAssetIds.has(asset.id)).map((asset) => asset.id),
    assetSidecarsMissingIndex: assetSidecars.filter((asset) => !dbAssetIds.has(asset.id)).map((asset) => asset.id),
    assetSidecarsMissingBinary: assetSidecars
      .filter((asset) => asset.storageKey && !binaryKeySet.has(asset.storageKey))
      .map((asset) => ({ id: asset.id, storageKey: asset.storageKey })),
  };

  return {
    ok: true,
    generatedAt: nowIso(),
    dataPrefix,
    legacyDataKey,
    legacyStorePresent: Boolean(legacyStore),
    totals: {
      clients: db.clients.length,
      projects: db.projects.length,
      projectStates: Object.keys(db.projectStates || {}).length,
      projectVersions: Array.from(dbVersionIds).length,
      projectVersionStates: Object.keys(db.projectVersionStates || {}).length,
      assetFolders: db.assetFolders.length,
      assets: db.assets.length,
      binaryObjects: binaryKeys.length,
      clientSidecars: clientSidecars.length,
      projectSidecars: projectSidecars.length,
      projectStateSidecars: projectStateSidecars.length,
      projectVersionSidecars: projectVersionSidecars.length,
      projectVersionStateSidecars: projectVersionStateSidecars.length,
      assetFolderSidecars: assetFolderSidecars.length,
      assetSidecars: assetSidecars.length,
    },
    issues,
  };
}

export async function rebuildStorageIndexesForSession(sessionRecord) {
  if (sessionRecord.user.role !== 'admin') throw new Error('Forbidden: rebuild requires admin access');
  const db = await readDb();
  await writeDb(db);
  return getStorageDiagnosticsForSession(sessionRecord);
}

function resolveDocumentRecord(sessionRecord, scope = 'autosave') {
  const entries = Object.values(sessionRecord.db.documentSlots || {}).filter((entry) => {
    return (
      entry?.scope === scope &&
      entry?.clientId === sessionRecord.activeClientId &&
      entry?.userId === sessionRecord.user.id
    );
  });

  if (!entries.length) return null;
  entries.sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
  return entries[0] ?? null;
}

export async function saveDocumentForSession(sessionRecord, scope, state) {
  const { db } = sessionRecord;
  db.documentSlots ??= {};
  const projectId = state?.ui?.activeProjectId || state?.document?.id || '';
  const slotKey = getDocumentSlotKey(sessionRecord, scope, projectId);
  db.documentSlots[slotKey] = {
    id: slotKey,
    scope,
    clientId: sessionRecord.activeClientId,
    userId: sessionRecord.user.id,
    projectId: projectId || undefined,
    updatedAt: nowIso(),
    state,
  };
  await writeDb(db);
  return db.documentSlots[slotKey];
}

export async function loadDocumentForSession(sessionRecord, scope) {
  const record = resolveDocumentRecord(sessionRecord, scope);
  return record?.state ?? null;
}

export async function hasDocumentForSession(sessionRecord, scope) {
  return Boolean(resolveDocumentRecord(sessionRecord, scope));
}

export async function clearDocumentForSession(sessionRecord, scope) {
  const { db } = sessionRecord;
  const nextEntries = Object.entries(db.documentSlots || {}).filter(([, entry]) => {
    return !(
      entry?.scope === scope &&
      entry?.clientId === sessionRecord.activeClientId &&
      entry?.userId === sessionRecord.user.id
    );
  });
  db.documentSlots = Object.fromEntries(nextEntries);
  await writeDb(db);
}

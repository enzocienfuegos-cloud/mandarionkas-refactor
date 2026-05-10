import { randomBytes } from 'node:crypto';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { hashPassword } from '../../config/src/security.mjs';

const LEGACY_SPLIT_FILES = [
  'users.json',
  'clients.json',
  'projects.json',
  'project-states.json',
  'project-versions.json',
  'project-version-states.json',
  'document-slots.json',
  'asset-folders.json',
  'assets.json',
  'sessions.json',
];

const ENTITY_COLLECTIONS = {
  clients: 'clients',
  projects: 'projects',
  projectStates: 'project-states',
  projectVersions: 'project-versions',
  projectVersionStates: 'project-version-states',
  assetFolders: 'asset-folders',
  assets: 'assets',
};

function nowIso() {
  return new Date().toISOString();
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDb(db) {
  const next = isRecord(db) ? { ...db } : {};
  next.users = Array.isArray(next.users) ? next.users : [];
  next.clients = Array.isArray(next.clients) ? next.clients : [];
  next.clients = next.clients.map((client) => ({
    ...client,
    brandColor: client?.brandColor ?? '#8b5cf6',
    memberUserIds: Array.from(new Set([
      client?.ownerUserId,
      ...(Array.isArray(client?.memberUserIds) ? client.memberUserIds : []),
      ...((Array.isArray(client?.members) ? client.members : []).map((member) => member?.userId)),
    ].filter(Boolean))),
    members: Array.isArray(client?.members)
      ? client.members
      : (Array.isArray(client?.memberUserIds) ? client.memberUserIds : []).map((userId) => ({
          userId,
          role: userId === client?.ownerUserId ? 'owner' : 'editor',
          addedAt: nowIso(),
        })),
    invites: Array.isArray(client?.invites) ? client.invites : [],
    brands: Array.isArray(client?.brands) ? client.brands : [],
  }));
  next.projects = Array.isArray(next.projects) ? next.projects : [];
  next.projectStates = isRecord(next.projectStates) ? next.projectStates : {};
  next.projectVersions = isRecord(next.projectVersions) ? next.projectVersions : {};
  next.projectVersionStates = isRecord(next.projectVersionStates) ? next.projectVersionStates : {};
  next.documentSlots = isRecord(next.documentSlots) ? next.documentSlots : {};
  next.assetFolders = Array.isArray(next.assetFolders) ? next.assetFolders : [];
  next.assets = Array.isArray(next.assets) ? next.assets : [];
  next.sessions = isRecord(next.sessions) ? next.sessions : {};
  return next;
}

function deriveDataPrefix(dataKey = 'platform-api/store.json', explicitPrefix = '') {
  const explicit = String(explicitPrefix || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const normalizedLegacyKey = String(dataKey || 'platform-api/store.json').trim().replace(/\/+$/, '');
  if (normalizedLegacyKey.endsWith('/store.json')) {
    return normalizedLegacyKey.slice(0, -'/store.json'.length) || 'platform-api';
  }
  const lastSlashIndex = normalizedLegacyKey.lastIndexOf('/');
  if (lastSlashIndex > 0) return normalizedLegacyKey.slice(0, lastSlashIndex);
  return 'platform-api';
}

function normalizeRole(role, fallback = 'editor') {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'admin' || value === 'editor' || value === 'reviewer' || value === 'owner') return value;
  return fallback;
}

function derivePlatformRole(globalRole) {
  const value = String(globalRole || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'reviewer') return 'reviewer';
  if (value === 'ad_ops') return 'ad_ops';
  return 'designer';
}

function deriveWorkspaceRole(globalRole) {
  const value = normalizeRole(globalRole, 'editor');
  if (value === 'owner') return 'owner';
  if (value === 'admin') return 'admin';
  if (value === 'reviewer') return 'viewer';
  return 'member';
}

function defaultProductAccessForPlatformRole(platformRole) {
  if (platformRole === 'designer') return { ad_server: false, studio: true };
  if (platformRole === 'ad_ops') return { ad_server: true, studio: false };
  return { ad_server: true, studio: true };
}

function normalizeAccessScope(value) {
  return value === 'private' || value === 'reviewers' ? value : 'client';
}

function normalizeAssetKind(value) {
  return value === 'image' || value === 'video' || value === 'font' ? value : 'other';
}

function normalizeSourceType(value, asset) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'url') return 'url';
  if (!asset?.storageKey && (asset?.originUrl || asset?.publicUrl || asset?.src)) return 'url';
  return 'upload';
}

function normalizeStorageMode(value, sourceType) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'remote-url') return 'remote-url';
  if (normalized === 'object-storage') return 'object-storage';
  return sourceType === 'url' ? 'remote-url' : 'object-storage';
}

function normalizeSlug(value, fallback) {
  const base = String(value || fallback || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback || 'workspace';
}

function uniqueSlug(base, used) {
  let candidate = normalizeSlug(base, 'workspace');
  let attempt = 2;
  while (used.has(candidate)) {
    candidate = `${normalizeSlug(base, 'workspace')}-${attempt}`;
    attempt += 1;
  }
  used.add(candidate);
  return candidate;
}

function normalizeEmail(value, fallbackLocalPart) {
  const base = String(value || '').trim().toLowerCase();
  if (base && base.includes('@')) return base;
  const local = normalizeSlug(fallbackLocalPart || 'user', 'user');
  return `${local}@legacy-import.local`;
}

function ensureUniqueEmail(baseEmail, usedEmails) {
  let candidate = baseEmail;
  let attempt = 2;
  while (usedEmails.has(candidate)) {
    const atIndex = candidate.indexOf('@');
    const local = atIndex > 0 ? candidate.slice(0, atIndex) : candidate;
    const domain = atIndex > 0 ? candidate.slice(atIndex + 1) : 'legacy-import.local';
    candidate = `${local}+${attempt}@${domain}`;
    attempt += 1;
  }
  usedEmails.add(candidate);
  return candidate;
}

function normalizeTimestamp(value, fallback = null) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureObject(value) {
  return isRecord(value) ? value : {};
}

function readJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return readJsonSafe(raw);
  } catch {
    return null;
  }
}

async function walkFiles(rootDir) {
  const files = [];
  async function visit(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  await visit(rootDir);
  return files;
}

function pickBestPath(paths) {
  if (!Array.isArray(paths) || !paths.length) return null;
  return [...paths].sort((left, right) => left.length - right.length || left.localeCompare(right))[0];
}

async function loadLegacyDatasetFromDir(sourceDir) {
  const files = await walkFiles(sourceDir);
  const byBaseName = new Map();
  for (const filePath of files) {
    const baseName = path.basename(filePath);
    const list = byBaseName.get(baseName) || [];
    list.push(filePath);
    byBaseName.set(baseName, list);
  }

  const loaded = {};
  for (const fileName of LEGACY_SPLIT_FILES) {
    const bestPath = pickBestPath(byBaseName.get(fileName) || []);
    loaded[fileName] = bestPath ? await readJsonFile(bestPath) : null;
  }

  const directDb = normalizeDb({
    users: Array.isArray(loaded['users.json']) ? loaded['users.json'] : [],
    clients: Array.isArray(loaded['clients.json']) ? loaded['clients.json'] : [],
    projects: Array.isArray(loaded['projects.json']) ? loaded['projects.json'] : [],
    projectStates: ensureObject(loaded['project-states.json']),
    projectVersions: ensureObject(loaded['project-versions.json']),
    projectVersionStates: ensureObject(loaded['project-version-states.json']),
    documentSlots: ensureObject(loaded['document-slots.json']),
    assetFolders: Array.isArray(loaded['asset-folders.json']) ? loaded['asset-folders.json'] : [],
    assets: Array.isArray(loaded['assets.json']) ? loaded['assets.json'] : [],
    sessions: ensureObject(loaded['sessions.json']),
  });

  const sidecars = {
    clients: [],
    projects: [],
    projectStates: [],
    projectVersions: [],
    projectVersionStates: [],
    assetFolders: [],
    assets: [],
  };

  for (const filePath of files) {
    if (!filePath.endsWith('.json')) continue;
    const normalized = filePath.split(path.sep).join('/');
    for (const [key, folderName] of Object.entries(ENTITY_COLLECTIONS)) {
      const marker = `/entities/${folderName}/`;
      if (normalized.includes(marker)) {
        const payload = await readJsonFile(filePath);
        if (isRecord(payload)) sidecars[key].push(payload);
      }
    }
  }

  return hydrateLegacySidecars(directDb, sidecars);
}

function createS3Client(options) {
  return new S3Client({
    region: 'auto',
    endpoint: options.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });
}

async function readJsonObjectFromR2(client, bucket, key) {
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const raw = await response.Body?.transformToString('utf8');
    return raw ? readJsonSafe(raw) : null;
  } catch {
    return null;
  }
}

async function listObjectKeysFromR2(client, bucket, prefix) {
  const keys = [];
  let continuationToken = undefined;
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const item of response.Contents || []) {
      if (item.Key) keys.push(item.Key);
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function loadLegacyDatasetFromR2(options) {
  const client = createS3Client(options);
  const prefix = deriveDataPrefix(options.dataKey, options.dataPrefix);
  const keys = {
    users: `${prefix}/users.json`,
    clients: `${prefix}/clients.json`,
    projects: `${prefix}/projects.json`,
    projectStates: `${prefix}/project-states.json`,
    projectVersions: `${prefix}/project-versions.json`,
    projectVersionStates: `${prefix}/project-version-states.json`,
    documentSlots: `${prefix}/document-slots.json`,
    assetFolders: `${prefix}/asset-folders.json`,
    assets: `${prefix}/assets.json`,
    sessions: `${prefix}/sessions.json`,
  };

  const [users, clients, projects, projectStates, projectVersions, projectVersionStates, documentSlots, assetFolders, assets, sessions] = await Promise.all([
    readJsonObjectFromR2(client, options.bucket, keys.users),
    readJsonObjectFromR2(client, options.bucket, keys.clients),
    readJsonObjectFromR2(client, options.bucket, keys.projects),
    readJsonObjectFromR2(client, options.bucket, keys.projectStates),
    readJsonObjectFromR2(client, options.bucket, keys.projectVersions),
    readJsonObjectFromR2(client, options.bucket, keys.projectVersionStates),
    readJsonObjectFromR2(client, options.bucket, keys.documentSlots),
    readJsonObjectFromR2(client, options.bucket, keys.assetFolders),
    readJsonObjectFromR2(client, options.bucket, keys.assets),
    readJsonObjectFromR2(client, options.bucket, keys.sessions),
  ]);

  const directDb = normalizeDb({
    users: Array.isArray(users) ? users : [],
    clients: Array.isArray(clients) ? clients : [],
    projects: Array.isArray(projects) ? projects : [],
    projectStates: ensureObject(projectStates),
    projectVersions: ensureObject(projectVersions),
    projectVersionStates: ensureObject(projectVersionStates),
    documentSlots: ensureObject(documentSlots),
    assetFolders: Array.isArray(assetFolders) ? assetFolders : [],
    assets: Array.isArray(assets) ? assets : [],
    sessions: ensureObject(sessions),
  });

  const sidecars = {};
  for (const [key, folderName] of Object.entries(ENTITY_COLLECTIONS)) {
    const objectKeys = await listObjectKeysFromR2(client, options.bucket, `${prefix}/entities/${folderName}/`);
    const payloads = await Promise.all(objectKeys.map((objectKey) => readJsonObjectFromR2(client, options.bucket, objectKey)));
    sidecars[key] = payloads.filter((entry) => isRecord(entry));
  }

  return hydrateLegacySidecars(directDb, sidecars);
}

function hydrateLegacySidecars(db, sidecars) {
  const next = normalizeDb(db);

  if (ensureArray(sidecars.clients).length) {
    const map = new Map(next.clients.map((item) => [item.id, item]));
    for (const item of sidecars.clients) map.set(item.id, { ...map.get(item.id), ...item });
    next.clients = Array.from(map.values());
  }

  if (ensureArray(sidecars.projects).length) {
    const map = new Map(next.projects.map((item) => [item.id, item]));
    for (const item of sidecars.projects) map.set(item.id, { ...map.get(item.id), ...item });
    next.projects = Array.from(map.values());
  }

  for (const entry of ensureArray(sidecars.projectStates)) {
    if (typeof entry?.projectId === 'string' && isRecord(entry.state)) {
      next.projectStates[entry.projectId] = entry.state;
    }
  }

  for (const entry of ensureArray(sidecars.projectVersions)) {
    if (typeof entry?.projectId !== 'string' || typeof entry?.id !== 'string') continue;
    const current = ensureArray(next.projectVersions[entry.projectId]).filter((item) => item.id !== entry.id);
    next.projectVersions[entry.projectId] = [...current, entry].sort((left, right) => Number(right?.versionNumber || 0) - Number(left?.versionNumber || 0));
  }

  for (const entry of ensureArray(sidecars.projectVersionStates)) {
    if (typeof entry?.versionId === 'string' && isRecord(entry.state)) {
      next.projectVersionStates[entry.versionId] = entry.state;
    }
  }

  if (ensureArray(sidecars.assetFolders).length) {
    const map = new Map(next.assetFolders.map((item) => [item.id, item]));
    for (const item of sidecars.assetFolders) map.set(item.id, { ...map.get(item.id), ...item });
    next.assetFolders = Array.from(map.values());
  }

  if (ensureArray(sidecars.assets).length) {
    const map = new Map(next.assets.map((item) => [item.id, item]));
    for (const item of sidecars.assets) map.set(item.id, { ...map.get(item.id), ...item });
    next.assets = Array.from(map.values());
  }

  return normalizeDb(next);
}

function buildFallbackState(project) {
  const projectId = String(project?.id || '').trim();
  const projectName = String(project?.name || 'Untitled Project').trim() || 'Untitled Project';
  const workspaceId = String(project?.clientId || '').trim() || 'workspace_missing';
  const workspaceName = String(project?.clientName || '').trim() || 'Imported Workspace';
  return {
    document: {
      id: projectId,
      name: projectName,
      scenes: [],
      metadata: {
        importedFromLegacy: true,
        legacyFallbackState: true,
        lastSavedAt: normalizeTimestamp(project?.updatedAt, nowIso()),
        platform: {
          clientId: workspaceId,
          clientName: workspaceName,
          brandId: project?.brandId || undefined,
          brandName: project?.brandName || undefined,
          campaignName: project?.campaignName || undefined,
          accessScope: normalizeAccessScope(project?.accessScope),
        },
      },
      canvas: project?.canvasPresetId ? { presetId: project.canvasPresetId } : {},
    },
    ui: {
      activeProjectId: projectId,
    },
  };
}

function coerceJson(value, fallback) {
  if (isRecord(value) || Array.isArray(value)) return value;
  return fallback;
}

export async function buildLegacyImportPlan(legacyDb) {
  const legacy = normalizeDb(legacyDb);
  const report = {
    generatedAt: nowIso(),
    sourceCounts: {
      users: legacy.users.length,
      clients: legacy.clients.length,
      projects: legacy.projects.length,
      projectStates: Object.keys(legacy.projectStates).length,
      projectVersions: Object.values(legacy.projectVersions).reduce((count, versions) => count + ensureArray(versions).length, 0),
      projectVersionStates: Object.keys(legacy.projectVersionStates).length,
      documentSlots: Object.keys(legacy.documentSlots).length,
      assetFolders: legacy.assetFolders.length,
      assets: legacy.assets.length,
      sessions: Object.keys(legacy.sessions).length,
    },
    targetCounts: {},
    warnings: [],
    skipped: {
      sessions: Object.keys(legacy.sessions).length,
      projectVersionsWithoutState: 0,
      assetsWithoutWorkspace: 0,
      foldersWithoutWorkspace: 0,
      draftsCollapsed: 0,
      duplicateWorkspaceStorageKeys: 0,
    },
    placeholders: {
      usersCreated: 0,
      projectsWithFallbackState: 0,
    },
    duplicateEmailsResolved: 0,
    duplicateWorkspaceSlugsResolved: 0,
  };

  const users = [];
  const workspaces = [];
  const members = [];
  const invites = [];
  const brands = [];
  const projects = [];
  const projectDocuments = [];
  const versions = [];
  const folders = [];
  const assets = [];
  const drafts = [];

  const userById = new Map();
  const userDisplayNames = new Map();
  const usedEmails = new Set();
  const usedWorkspaceSlugs = new Set();

  for (const legacyUser of legacy.users) {
    const userId = String(legacyUser?.id || '').trim();
    if (!userId) {
      report.warnings.push('Skipped a legacy user without id.');
      continue;
    }
    const role = normalizeRole(legacyUser?.role, 'editor');
    const baseEmail = normalizeEmail(legacyUser?.email, userId);
    const email = ensureUniqueEmail(baseEmail, usedEmails);
    if (email !== baseEmail) report.duplicateEmailsResolved += 1;
    const displayName = String(legacyUser?.name || legacyUser?.displayName || userId).trim() || userId;
    const passwordHash = await hashPassword(String(legacyUser?.password || randomBytes(12).toString('hex')));
    const createdAt = normalizeTimestamp(legacyUser?.createdAt, nowIso());
    const updatedAt = normalizeTimestamp(legacyUser?.updatedAt, createdAt);
    const globalRole = role === 'owner' ? 'editor' : role;
    const userRow = { id: userId, email, passwordHash, displayName, globalRole, platformRole: derivePlatformRole(globalRole), createdAt, updatedAt };
    users.push(userRow);
    userById.set(userId, userRow);
    userDisplayNames.set(userId, displayName);
  }

  function ensureUser(userId, fallbackName, fallbackRole = 'editor') {
    const normalizedId = String(userId || '').trim();
    if (!normalizedId) return null;
    if (userById.has(normalizedId)) return userById.get(normalizedId);
    report.placeholders.usersCreated += 1;
    report.warnings.push(`Created placeholder user for missing legacy reference: ${normalizedId}.`);
    const email = ensureUniqueEmail(normalizeEmail('', normalizedId), usedEmails);
    const userRow = {
      id: normalizedId,
      email,
      passwordHash: '',
      displayName: String(fallbackName || normalizedId).trim() || normalizedId,
      globalRole: normalizeRole(fallbackRole, 'editor') === 'owner' ? 'editor' : normalizeRole(fallbackRole, 'editor'),
      platformRole: derivePlatformRole(normalizeRole(fallbackRole, 'editor') === 'owner' ? 'editor' : normalizeRole(fallbackRole, 'editor')),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    userById.set(normalizedId, userRow);
    userDisplayNames.set(normalizedId, userRow.displayName);
    users.push(userRow);
    return userRow;
  }

  const workspaceById = new Map();
  const brandIdsByWorkspace = new Map();

  for (const legacyClient of legacy.clients) {
    const workspaceId = String(legacyClient?.id || '').trim();
    if (!workspaceId) {
      report.warnings.push('Skipped a legacy client without id.');
      continue;
    }
    const owner = ensureUser(legacyClient?.ownerUserId || workspaceId, legacyClient?.name || workspaceId, 'admin');
    const slugBase = legacyClient?.slug || legacyClient?.name || workspaceId;
    const unique = uniqueSlug(slugBase, usedWorkspaceSlugs);
    if (normalizeSlug(slugBase, workspaceId) !== unique) report.duplicateWorkspaceSlugsResolved += 1;
    const createdAt = normalizeTimestamp(legacyClient?.createdAt, nowIso());
    const updatedAt = normalizeTimestamp(legacyClient?.updatedAt, createdAt);
    const workspaceRow = {
      id: workspaceId,
      slug: unique,
      name: String(legacyClient?.name || workspaceId).trim() || workspaceId,
      brandColor: String(legacyClient?.brandColor || '#8b5cf6').trim() || '#8b5cf6',
      ownerUserId: owner.id,
      createdAt,
      updatedAt,
      archivedAt: normalizeTimestamp(legacyClient?.archivedAt, null),
    };
    workspaces.push(workspaceRow);
    workspaceById.set(workspaceId, workspaceRow);
    brandIdsByWorkspace.set(workspaceId, new Set());

    const memberMap = new Map();
    memberMap.set(owner.id, {
      workspaceId,
      userId: owner.id,
      role: 'owner',
      addedAt: normalizeTimestamp(legacyClient?.createdAt, createdAt),
      productAccess: { ad_server: true, studio: true },
    });
    for (const member of ensureArray(legacyClient?.members)) {
      const user = ensureUser(member?.userId, member?.userId, normalizeRole(member?.role, 'editor'));
      if (!user) continue;
      const platformRole = derivePlatformRole(user.globalRole);
      memberMap.set(user.id, {
        workspaceId,
        userId: user.id,
        role: deriveWorkspaceRole(member?.role || (user.id === owner.id ? 'owner' : 'editor')),
        addedAt: normalizeTimestamp(member?.addedAt, createdAt),
        productAccess: defaultProductAccessForPlatformRole(platformRole),
      });
    }
    for (const userId of ensureArray(legacyClient?.memberUserIds)) {
      const user = ensureUser(userId, userId, userId === owner.id ? 'owner' : 'editor');
      if (!user) continue;
      if (!memberMap.has(user.id)) {
        const platformRole = derivePlatformRole(user.globalRole);
        memberMap.set(user.id, {
          workspaceId,
          userId: user.id,
          role: user.id === owner.id ? 'owner' : deriveWorkspaceRole(user.globalRole),
          addedAt: createdAt,
          productAccess: defaultProductAccessForPlatformRole(platformRole),
        });
      }
    }
    members.push(...memberMap.values());

    for (const invite of ensureArray(legacyClient?.invites)) {
      const inviteId = String(invite?.id || `${workspaceId}:${invite?.email || randomBytes(6).toString('hex')}`);
      const platformRole = derivePlatformRole(normalizeRole(invite?.role, 'editor') === 'owner' ? 'admin' : normalizeRole(invite?.role, 'editor'));
      invites.push({
        id: inviteId,
        workspaceId,
        email: normalizeEmail(invite?.email, inviteId),
        role: deriveWorkspaceRole(normalizeRole(invite?.role, 'editor') === 'owner' ? 'admin' : normalizeRole(invite?.role, 'editor')),
        status: ['accepted', 'revoked'].includes(String(invite?.status || '').trim()) ? String(invite.status).trim() : 'pending',
        invitedByUserId: owner.id,
        invitedAt: normalizeTimestamp(invite?.invitedAt, createdAt),
        acceptedAt: normalizeTimestamp(invite?.acceptedAt, null),
        revokedAt: normalizeTimestamp(invite?.revokedAt, null),
        productAccess: defaultProductAccessForPlatformRole(platformRole),
      });
    }

    for (const brand of ensureArray(legacyClient?.brands)) {
      const brandId = String(brand?.id || `${workspaceId}:brand:${normalizeSlug(brand?.name || 'brand', 'brand')}`);
      brandIdsByWorkspace.get(workspaceId)?.add(brandId);
      brands.push({
        id: brandId,
        workspaceId,
        name: String(brand?.name || 'Untitled Brand').trim() || 'Untitled Brand',
        primaryColor: brand?.primaryColor || legacyClient?.brandColor || '#8b5cf6',
        secondaryColor: brand?.secondaryColor || '#0f172a',
        accentColor: brand?.accentColor || brand?.primaryColor || legacyClient?.brandColor || '#8b5cf6',
        logoUrl: brand?.logoUrl || null,
        fontFamily: brand?.fontFamily || null,
        createdAt,
        updatedAt: normalizeTimestamp(brand?.updatedAt, updatedAt),
      });
    }
  }

  const workspaceFallbackIds = new Set();
  function ensureWorkspace(workspaceId, fallbackName = 'Imported Workspace') {
    const normalizedId = String(workspaceId || '').trim();
    if (!normalizedId) return null;
    if (workspaceById.has(normalizedId)) return workspaceById.get(normalizedId);
    const adminUser = users.find((user) => user.globalRole === 'admin') || users[0] || ensureUser('legacy_admin', 'Legacy Admin', 'admin');
    const slug = uniqueSlug(normalizedId, usedWorkspaceSlugs);
    report.warnings.push(`Created placeholder workspace for missing legacy reference: ${normalizedId}.`);
    workspaceFallbackIds.add(normalizedId);
    const workspaceRow = {
      id: normalizedId,
      slug,
      name: String(fallbackName || normalizedId).trim() || normalizedId,
      brandColor: '#8b5cf6',
      ownerUserId: adminUser.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      archivedAt: null,
    };
    workspaces.push(workspaceRow);
    members.push({
      workspaceId: normalizedId,
      userId: adminUser.id,
      role: 'owner',
      addedAt: nowIso(),
      productAccess: { ad_server: true, studio: true },
    });
    workspaceById.set(normalizedId, workspaceRow);
    brandIdsByWorkspace.set(normalizedId, new Set());
    return workspaceRow;
  }

  const projectIds = new Set();
  const versionIds = new Set();
  const assetIds = new Set();
  const folderIds = new Set();
  const draftDedup = new Map();
  const storageKeyByWorkspace = new Set();

  for (const project of legacy.projects) {
    const projectId = String(project?.id || '').trim();
    if (!projectId || projectIds.has(projectId)) {
      if (projectId) report.warnings.push(`Skipped duplicate project id during import planning: ${projectId}.`);
      continue;
    }
    projectIds.add(projectId);
    const workspace = ensureWorkspace(project?.clientId, project?.clientName || 'Imported Workspace');
    if (!workspace) continue;
    const owner = ensureUser(project?.ownerUserId || workspace.ownerUserId, project?.ownerName || project?.ownerUserId || 'Imported Owner', 'editor');
    const brandIdCandidate = project?.brandId ? String(project.brandId) : null;
    const brandId = brandIdCandidate && brandIdsByWorkspace.get(workspace.id)?.has(brandIdCandidate) ? brandIdCandidate : null;
    const createdAt = normalizeTimestamp(project?.createdAt, normalizeTimestamp(project?.updatedAt, nowIso()));
    const updatedAt = normalizeTimestamp(project?.updatedAt, createdAt);
    const projectRow = {
      id: projectId,
      workspaceId: workspace.id,
      ownerUserId: owner.id,
      name: String(project?.name || 'Untitled Project').trim() || 'Untitled Project',
      brandId,
      campaignName: project?.campaignName || null,
      accessScope: normalizeAccessScope(project?.accessScope),
      canvasPresetId: project?.canvasPresetId || null,
      sceneCount: Number.isFinite(project?.sceneCount) ? project.sceneCount : 0,
      widgetCount: Number.isFinite(project?.widgetCount) ? project.widgetCount : 0,
      archivedAt: normalizeTimestamp(project?.archivedAt, null),
      createdAt,
      updatedAt,
    };
    projects.push(projectRow);

    const state = coerceJson(legacy.projectStates[projectId], null);
    const nextState = state || buildFallbackState({ ...project, clientId: workspace.id, clientName: workspace.name });
    if (!state) report.placeholders.projectsWithFallbackState += 1;
    projectDocuments.push({
      projectId,
      revision: 1,
      documentState: nextState,
      updatedAt,
      updatedByUserId: owner.id,
    });

    const versionsForProject = ensureArray(legacy.projectVersions[projectId]);
    const sortedVersions = [...versionsForProject].sort((left, right) => Number(left?.versionNumber || 0) - Number(right?.versionNumber || 0));
    for (const version of sortedVersions) {
      const versionId = String(version?.id || '').trim();
      if (!versionId || versionIds.has(versionId)) {
        if (versionId) report.warnings.push(`Skipped duplicate version id during import planning: ${versionId}.`);
        continue;
      }
      const snapshotState = coerceJson(legacy.projectVersionStates[versionId], null);
      if (!snapshotState) {
        report.skipped.projectVersionsWithoutState += 1;
        report.warnings.push(`Skipped legacy version without snapshot state: ${versionId} for project ${projectId}.`);
        continue;
      }
      versionIds.add(versionId);
      versions.push({
        id: versionId,
        projectId,
        versionNumber: Number.isFinite(version?.versionNumber) ? version.versionNumber : versions.filter((entry) => entry.projectId === projectId).length + 1,
        note: version?.note || null,
        snapshotState,
        savedAt: normalizeTimestamp(version?.savedAt, updatedAt),
        savedByUserId: owner.id,
      });
    }
  }

  for (const folder of legacy.assetFolders) {
    const folderId = String(folder?.id || '').trim();
    if (!folderId || folderIds.has(folderId)) {
      if (folderId) report.warnings.push(`Skipped duplicate folder id during import planning: ${folderId}.`);
      continue;
    }
    const workspace = ensureWorkspace(folder?.clientId, 'Imported Workspace');
    if (!workspace) {
      report.skipped.foldersWithoutWorkspace += 1;
      continue;
    }
    folderIds.add(folderId);
    const owner = ensureUser(folder?.ownerUserId || workspace.ownerUserId, folder?.ownerUserId || workspace.ownerUserId, 'editor');
    const parentId = folder?.parentId && folder?.parentId !== folderId ? String(folder.parentId) : null;
    folders.push({
      id: folderId,
      workspaceId: workspace.id,
      ownerUserId: owner.id,
      parentId,
      name: String(folder?.name || 'Untitled Folder').trim() || 'Untitled Folder',
      createdAt: normalizeTimestamp(folder?.createdAt, nowIso()),
      updatedAt: normalizeTimestamp(folder?.updatedAt, normalizeTimestamp(folder?.createdAt, nowIso())),
    });
  }

  for (const asset of legacy.assets) {
    const assetId = String(asset?.id || '').trim();
    if (!assetId || assetIds.has(assetId)) {
      if (assetId) report.warnings.push(`Skipped duplicate asset id during import planning: ${assetId}.`);
      continue;
    }
    const workspace = ensureWorkspace(asset?.clientId, 'Imported Workspace');
    if (!workspace) {
      report.skipped.assetsWithoutWorkspace += 1;
      continue;
    }
    const owner = ensureUser(asset?.ownerUserId || workspace.ownerUserId, asset?.ownerUserId || workspace.ownerUserId, 'editor');
    const sourceType = normalizeSourceType(asset?.sourceType, asset);
    const storageMode = normalizeStorageMode(asset?.storageMode, sourceType);
    const storageKey = asset?.storageKey ? String(asset.storageKey).trim() : null;
    if (storageKey) {
      const dedupeKey = `${workspace.id}::${storageKey}`;
      if (storageKeyByWorkspace.has(dedupeKey)) {
        report.skipped.duplicateWorkspaceStorageKeys += 1;
        report.warnings.push(`Skipped asset with duplicate storage key inside workspace ${workspace.id}: ${assetId}.`);
        continue;
      }
      storageKeyByWorkspace.add(dedupeKey);
    }
    assetIds.add(assetId);
    const publicUrl = asset?.publicUrl || (storageMode === 'remote-url' ? asset?.src : null) || null;
    const originUrl = asset?.originUrl || (sourceType === 'url' ? asset?.src : null) || null;
    assets.push({
      id: assetId,
      workspaceId: workspace.id,
      ownerUserId: owner.id,
      folderId: asset?.folderId ? String(asset.folderId) : null,
      uploadSessionId: null,
      name: String(asset?.name || 'Untitled Asset').trim() || 'Untitled Asset',
      kind: normalizeAssetKind(asset?.kind),
      mimeType: asset?.mimeType || null,
      sourceType,
      storageMode,
      storageKey,
      publicUrl,
      originUrl,
      posterSrc: asset?.posterSrc || null,
      thumbnailUrl: asset?.thumbnailUrl || null,
      accessScope: asset?.accessScope === 'private' ? 'private' : 'client',
      tags: ensureArray(asset?.tags).map((tag) => String(tag).trim()).filter(Boolean),
      sizeBytes: Number.isFinite(asset?.sizeBytes) ? asset.sizeBytes : null,
      width: Number.isFinite(asset?.width) ? asset.width : null,
      height: Number.isFinite(asset?.height) ? asset.height : null,
      durationMs: Number.isFinite(asset?.durationMs) ? asset.durationMs : null,
      fingerprint: asset?.fingerprint || null,
      fontFamily: asset?.fontFamily || null,
      metadata: ensureObject(asset?.metadata),
      createdAt: normalizeTimestamp(asset?.createdAt, nowIso()),
      updatedAt: normalizeTimestamp(asset?.updatedAt, normalizeTimestamp(asset?.createdAt, nowIso())),
    });
  }

  for (const entry of Object.values(legacy.documentSlots)) {
    const scope = String(entry?.scope || '').trim();
    if (scope !== 'autosave' && scope !== 'manual') continue;
    const workspace = ensureWorkspace(entry?.clientId, 'Imported Workspace');
    const user = ensureUser(entry?.userId, entry?.userId, 'editor');
    if (!workspace || !user) continue;
    const dedupeKey = `${user.id}::${workspace.id}::${scope}`;
    const updatedAt = normalizeTimestamp(entry?.updatedAt, nowIso());
    const existing = draftDedup.get(dedupeKey);
    if (existing && new Date(existing.updatedAt).getTime() >= new Date(updatedAt).getTime()) {
      report.skipped.draftsCollapsed += 1;
      continue;
    }
    if (existing) report.skipped.draftsCollapsed += 1;
    draftDedup.set(dedupeKey, {
      userId: user.id,
      workspaceId: workspace.id,
      kind: scope === 'manual' ? 'manual' : 'autosave',
      documentState: coerceJson(entry?.state, buildFallbackState({ id: entry?.projectId || '', name: 'Imported Draft', clientId: workspace.id, clientName: workspace.name })),
      revision: 1,
      updatedAt,
      updatedByUserId: user.id,
    });
  }
  drafts.push(...draftDedup.values());

  for (const user of users) {
    if (!user.passwordHash) {
      user.passwordHash = await hashPassword(randomBytes(18).toString('hex'));
    }
  }

  report.targetCounts = {
    users: users.length,
    workspaces: workspaces.length,
    workspaceMembers: members.length,
    workspaceInvites: invites.length,
    brands: brands.length,
    projects: projects.length,
    projectDocuments: projectDocuments.length,
    projectVersions: versions.length,
    assetFolders: folders.length,
    assets: assets.length,
    userDocumentDrafts: drafts.length,
  };

  return {
    users,
    workspaces,
    members,
    invites,
    brands,
    projects,
    projectDocuments,
    versions,
    folders,
    assets,
    drafts,
    report,
  };
}

export async function verifyAssetObjects(assets, options) {
  if (!options?.endpoint || !options?.bucket || !options?.accessKeyId || !options?.secretAccessKey) {
    return {
      enabled: false,
      checked: 0,
      existing: 0,
      missing: 0,
      errors: [],
    };
  }

  const client = createS3Client(options);
  const summary = {
    enabled: true,
    checked: 0,
    existing: 0,
    missing: 0,
    errors: [],
  };

  for (const asset of assets) {
    if (!asset.storageKey) continue;
    summary.checked += 1;
    try {
      await client.send(new HeadObjectCommand({ Bucket: options.bucket, Key: asset.storageKey }));
      summary.existing += 1;
    } catch {
      summary.missing += 1;
      summary.errors.push(`Missing object for storage key: ${asset.storageKey}`);
    }
  }
  return summary;
}

export async function applyLegacyImportPlan(dbClient, plan, options = {}) {
  const resetTarget = Boolean(options.resetTarget);
  const clearSessions = options.clearSessions !== false;

  await dbClient.query('begin');
  try {
    if (resetTarget) {
      await dbClient.query(`
        truncate table
          audit_events,
          assets,
          asset_upload_sessions,
          asset_folders,
          project_versions,
          project_documents,
          projects,
          brands,
          workspace_invites,
          workspace_members,
          workspaces,
          user_document_drafts,
          sessions,
          users
        restart identity cascade
      `);
    } else if (clearSessions) {
      await dbClient.query('delete from sessions');
    }

    for (const row of plan.users) {
      await dbClient.query(
        `
          insert into users (id, email, password_hash, display_name, global_role, platform_role, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
          on conflict (id) do update
          set email = excluded.email,
              password_hash = excluded.password_hash,
              display_name = excluded.display_name,
              global_role = excluded.global_role,
              platform_role = excluded.platform_role,
              updated_at = excluded.updated_at
        `,
        [row.id, row.email, row.passwordHash, row.displayName, row.globalRole, row.platformRole, row.createdAt, row.updatedAt],
      );
    }

    for (const row of plan.workspaces) {
      await dbClient.query(
        `
          insert into workspaces (id, slug, name, brand_color, owner_user_id, created_at, updated_at, archived_at)
          values ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8::timestamptz)
          on conflict (id) do update
          set slug = excluded.slug,
              name = excluded.name,
              brand_color = excluded.brand_color,
              owner_user_id = excluded.owner_user_id,
              updated_at = excluded.updated_at,
              archived_at = excluded.archived_at
        `,
        [row.id, row.slug, row.name, row.brandColor, row.ownerUserId, row.createdAt, row.updatedAt, row.archivedAt],
      );
    }

    for (const row of plan.members) {
      await dbClient.query(
        `
          insert into workspace_members (workspace_id, user_id, role, added_at, product_access)
          values ($1, $2, $3, $4::timestamptz, $5::jsonb)
          on conflict (workspace_id, user_id) do update
          set role = excluded.role,
              added_at = excluded.added_at,
              product_access = excluded.product_access
        `,
        [row.workspaceId, row.userId, row.role, row.addedAt, JSON.stringify(row.productAccess || { ad_server: true, studio: true })],
      );
    }

    for (const row of plan.invites) {
      await dbClient.query(
        `
          insert into workspace_invites (id, workspace_id, email, role, status, invited_by_user_id, invited_at, accepted_at, revoked_at, product_access)
          values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10::jsonb)
          on conflict (id) do update
          set email = excluded.email,
              role = excluded.role,
              status = excluded.status,
              invited_by_user_id = excluded.invited_by_user_id,
              invited_at = excluded.invited_at,
              accepted_at = excluded.accepted_at,
              revoked_at = excluded.revoked_at,
              product_access = excluded.product_access
        `,
        [row.id, row.workspaceId, row.email, row.role, row.status, row.invitedByUserId, row.invitedAt, row.acceptedAt, row.revokedAt, JSON.stringify(row.productAccess || { ad_server: true, studio: true })],
      );
    }

    for (const row of plan.brands) {
      await dbClient.query(
        `
          insert into brands (id, workspace_id, name, primary_color, secondary_color, accent_color, logo_url, font_family, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz)
          on conflict (id) do update
          set name = excluded.name,
              primary_color = excluded.primary_color,
              secondary_color = excluded.secondary_color,
              accent_color = excluded.accent_color,
              logo_url = excluded.logo_url,
              font_family = excluded.font_family,
              updated_at = excluded.updated_at
        `,
        [row.id, row.workspaceId, row.name, row.primaryColor, row.secondaryColor, row.accentColor, row.logoUrl, row.fontFamily, row.createdAt, row.updatedAt],
      );
    }

    for (const row of plan.projects) {
      await dbClient.query(
        `
          insert into projects (id, workspace_id, owner_user_id, name, brand_id, campaign_name, access_scope, canvas_preset_id, scene_count, widget_count, archived_at, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz, $13::timestamptz)
          on conflict (id) do update
          set workspace_id = excluded.workspace_id,
              owner_user_id = excluded.owner_user_id,
              name = excluded.name,
              brand_id = excluded.brand_id,
              campaign_name = excluded.campaign_name,
              access_scope = excluded.access_scope,
              canvas_preset_id = excluded.canvas_preset_id,
              scene_count = excluded.scene_count,
              widget_count = excluded.widget_count,
              archived_at = excluded.archived_at,
              updated_at = excluded.updated_at
        `,
        [row.id, row.workspaceId, row.ownerUserId, row.name, row.brandId, row.campaignName, row.accessScope, row.canvasPresetId, row.sceneCount, row.widgetCount, row.archivedAt, row.createdAt, row.updatedAt],
      );
    }

    for (const row of plan.projectDocuments) {
      await dbClient.query(
        `
          insert into project_documents (project_id, revision, document_state, updated_at, updated_by_user_id)
          values ($1, $2, $3::jsonb, $4::timestamptz, $5)
          on conflict (project_id) do update
          set revision = excluded.revision,
              document_state = excluded.document_state,
              updated_at = excluded.updated_at,
              updated_by_user_id = excluded.updated_by_user_id
        `,
        [row.projectId, row.revision, JSON.stringify(row.documentState), row.updatedAt, row.updatedByUserId],
      );
    }

    for (const row of plan.versions) {
      await dbClient.query(
        `
          insert into project_versions (id, project_id, version_number, note, snapshot_state, saved_at, saved_by_user_id)
          values ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7)
          on conflict (id) do update
          set project_id = excluded.project_id,
              version_number = excluded.version_number,
              note = excluded.note,
              snapshot_state = excluded.snapshot_state,
              saved_at = excluded.saved_at,
              saved_by_user_id = excluded.saved_by_user_id
        `,
        [row.id, row.projectId, row.versionNumber, row.note, JSON.stringify(row.snapshotState), row.savedAt, row.savedByUserId],
      );
    }

    for (const row of plan.folders) {
      await dbClient.query(
        `
          insert into asset_folders (id, workspace_id, owner_user_id, parent_id, name, created_at, updated_at)
          values ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
          on conflict (id) do update
          set workspace_id = excluded.workspace_id,
              owner_user_id = excluded.owner_user_id,
              parent_id = excluded.parent_id,
              name = excluded.name,
              updated_at = excluded.updated_at
        `,
        [row.id, row.workspaceId, row.ownerUserId, row.parentId, row.name, row.createdAt, row.updatedAt],
      );
    }

    for (const row of plan.assets) {
      await dbClient.query(
        `
          insert into assets (
            id, workspace_id, owner_user_id, folder_id, upload_session_id, name, kind, mime_type,
            source_type, storage_mode, storage_key, public_url, origin_url, poster_src, thumbnail_url,
            access_scope, tags, size_bytes, width, height, duration_ms, fingerprint, font_family, metadata,
            created_at, updated_at
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15,
            $16, $17::text[], $18, $19, $20, $21, $22, $23, $24::jsonb,
            $25::timestamptz, $26::timestamptz
          )
          on conflict (id) do update
          set workspace_id = excluded.workspace_id,
              owner_user_id = excluded.owner_user_id,
              folder_id = excluded.folder_id,
              upload_session_id = excluded.upload_session_id,
              name = excluded.name,
              kind = excluded.kind,
              mime_type = excluded.mime_type,
              source_type = excluded.source_type,
              storage_mode = excluded.storage_mode,
              storage_key = excluded.storage_key,
              public_url = excluded.public_url,
              origin_url = excluded.origin_url,
              poster_src = excluded.poster_src,
              thumbnail_url = excluded.thumbnail_url,
              access_scope = excluded.access_scope,
              tags = excluded.tags,
              size_bytes = excluded.size_bytes,
              width = excluded.width,
              height = excluded.height,
              duration_ms = excluded.duration_ms,
              fingerprint = excluded.fingerprint,
              font_family = excluded.font_family,
              metadata = excluded.metadata,
              updated_at = excluded.updated_at
        `,
        [
          row.id,
          row.workspaceId,
          row.ownerUserId,
          row.folderId,
          row.uploadSessionId,
          row.name,
          row.kind,
          row.mimeType,
          row.sourceType,
          row.storageMode,
          row.storageKey,
          row.publicUrl,
          row.originUrl,
          row.posterSrc,
          row.thumbnailUrl,
          row.accessScope,
          row.tags,
          row.sizeBytes,
          row.width,
          row.height,
          row.durationMs,
          row.fingerprint,
          row.fontFamily,
          JSON.stringify(row.metadata || {}),
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of plan.drafts) {
      await dbClient.query(
        `
          insert into user_document_drafts (user_id, workspace_id, kind, document_state, revision, updated_at, updated_by_user_id)
          values ($1, $2, $3, $4::jsonb, $5, $6::timestamptz, $7)
          on conflict (user_id, kind) do update
          set workspace_id = excluded.workspace_id,
              document_state = excluded.document_state,
              revision = excluded.revision,
              updated_at = excluded.updated_at,
              updated_by_user_id = excluded.updated_by_user_id
        `,
        [row.userId, row.workspaceId, row.kind, JSON.stringify(row.documentState), row.revision, row.updatedAt, row.updatedByUserId],
      );
    }

    await dbClient.query(
      `
        insert into audit_events (id, workspace_id, actor_user_id, action, target_type, target_id, payload)
        values ($1, null, null, 'legacy_import_completed', 'system', null, $2::jsonb)
      `,
      [randomBytes(12).toString('hex'), JSON.stringify({
        importedAt: nowIso(),
        counts: plan.report.targetCounts,
        skipped: plan.report.skipped,
        placeholders: plan.report.placeholders,
      })],
    );

    await dbClient.query('commit');
  } catch (error) {
    await dbClient.query('rollback');
    throw error;
  }
}

export async function writeImportReport(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

export function formatImportReportMarkdown(report) {
  const lines = [];
  lines.push('# Legacy import report');
  lines.push('');
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Source counts');
  for (const [key, value] of Object.entries(report.sourceCounts || {})) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('');
  lines.push('## Target counts');
  for (const [key, value] of Object.entries(report.targetCounts || {})) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('');
  lines.push('## Skipped');
  for (const [key, value] of Object.entries(report.skipped || {})) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('');
  lines.push('## Placeholders');
  for (const [key, value] of Object.entries(report.placeholders || {})) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('');
  if (report.assetVerification) {
    lines.push('## Asset verification');
    lines.push(`- enabled: ${report.assetVerification.enabled}`);
    lines.push(`- checked: ${report.assetVerification.checked}`);
    lines.push(`- existing: ${report.assetVerification.existing}`);
    lines.push(`- missing: ${report.assetVerification.missing}`);
    lines.push('');
  }
  lines.push('## Warnings');
  if (Array.isArray(report.warnings) && report.warnings.length) {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push('- none');
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export async function writeImportReportMarkdown(reportPath, report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, formatImportReportMarkdown(report), 'utf8');
}

export async function loadLegacyDataset(options) {
  if (options?.sourceDir) {
    return loadLegacyDatasetFromDir(path.resolve(options.sourceDir));
  }
  if (options?.sourceFile) {
    const payload = await readJsonFile(path.resolve(options.sourceFile));
    return normalizeDb(payload);
  }
  if (options?.r2?.endpoint && options?.r2?.bucket && options?.r2?.accessKeyId && options?.r2?.secretAccessKey) {
    return loadLegacyDatasetFromR2(options.r2);
  }
  throw new Error('Provide --source-dir, --source-file, or legacy R2 credentials.');
}

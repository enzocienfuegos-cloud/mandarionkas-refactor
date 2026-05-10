import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export function summarizeDb(db) {
  const projectVersionCount = Object.values(db.projectVersions || {}).reduce(
    (total, versions) => total + (Array.isArray(versions) ? versions.length : 0),
    0,
  );

  return {
    users: db.users.length,
    clients: db.clients.length,
    projects: db.projects.length,
    projectStates: Object.keys(db.projectStates || {}).length,
    projectVersions: projectVersionCount,
    projectVersionStates: Object.keys(db.projectVersionStates || {}).length,
    documentSlots: Object.keys(db.documentSlots || {}).length,
    assetFolders: db.assetFolders.length,
    assets: db.assets.length,
    sessions: Object.keys(db.sessions || {}).length,
    auditEvents: Array.isArray(db.auditEvents) ? db.auditEvents.length : 0,
  };
}

export function buildSnapshotPayload({ db, repository, exportedAt = new Date().toISOString() }) {
  return {
    ok: true,
    exportedAt,
    repository,
    summary: summarizeDb(db),
    db,
  };
}

export async function writeSnapshotFile(path, payload) {
  const targetPath = resolve(path);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return targetPath;
}

export async function loadSnapshotFile(path) {
  const absolutePath = resolve(path);
  const raw = await readFile(absolutePath, 'utf8');
  return {
    absolutePath,
    parsed: JSON.parse(raw),
  };
}

function sortedKeys(record) {
  return Object.keys(record || {}).sort();
}

function collectProjectVersionIds(record) {
  return Object.values(record || {})
    .flatMap((versions) => (Array.isArray(versions) ? versions : []))
    .map((version) => version?.id)
    .filter(Boolean)
    .sort();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function toIdList(items) {
  return uniqueSorted((items || []).map((item) => item?.id));
}

function diffLists(left, right, limit = 20) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const onlyLeft = left.filter((value) => !rightSet.has(value));
  const onlyRight = right.filter((value) => !leftSet.has(value));
  return {
    onlyLeft: onlyLeft.slice(0, limit),
    onlyRight: onlyRight.slice(0, limit),
    onlyLeftTotal: onlyLeft.length,
    onlyRightTotal: onlyRight.length,
  };
}

function compareSummaries(left, right) {
  const keys = uniqueSorted([...Object.keys(left || {}), ...Object.keys(right || {})]);
  return keys
    .map((key) => ({
      field: key,
      left: left?.[key] ?? 0,
      right: right?.[key] ?? 0,
    }))
    .filter((entry) => entry.left !== entry.right);
}

function buildIdentityMap(snapshot) {
  const db = snapshot.db || {};
  return {
    users: toIdList(db.users),
    clients: toIdList(db.clients),
    projects: toIdList(db.projects),
    projectStates: sortedKeys(db.projectStates),
    projectVersions: collectProjectVersionIds(db.projectVersions),
    projectVersionStates: sortedKeys(db.projectVersionStates),
    documentSlots: sortedKeys(db.documentSlots),
    assetFolders: toIdList(db.assetFolders),
    assets: toIdList(db.assets),
    sessions: sortedKeys(db.sessions),
  };
}

export function compareSnapshotPayloads(leftSnapshot, rightSnapshot) {
  const leftMap = buildIdentityMap(leftSnapshot);
  const rightMap = buildIdentityMap(rightSnapshot);
  const summaryDiffs = compareSummaries(leftSnapshot.summary, rightSnapshot.summary);
  const domains = uniqueSorted([...Object.keys(leftMap), ...Object.keys(rightMap)]);
  const identityDiffs = domains
    .map((domain) => ({
      domain,
      ...diffLists(leftMap[domain] || [], rightMap[domain] || []),
    }))
    .filter((entry) => entry.onlyLeftTotal > 0 || entry.onlyRightTotal > 0);

  return {
    ok: summaryDiffs.length === 0 && identityDiffs.length === 0,
    summaryDiffs,
    identityDiffs,
  };
}

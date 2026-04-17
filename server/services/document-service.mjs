import { documentRepository } from '../contracts/document-repository.mjs';
import { createAuditActor, createAuditEvent } from './audit-service.mjs';
import { nowIso } from './shared.mjs';

function getDocumentSlotKey(sessionRecord, scope = 'autosave', projectId = '') {
  const normalizedProjectId = String(projectId || '').trim() || 'workspace';
  return `${scope}:${sessionRecord.activeClientId || 'client_default'}:${sessionRecord.user.id}:${normalizedProjectId}`;
}

async function resolveDocumentRecord(sessionRecord, scope = 'autosave') {
  const entries = await documentRepository.listDocumentSlots({
    scope,
    clientId: sessionRecord.activeClientId,
    userId: sessionRecord.user.id,
  });
  if (!entries.length) return null;
  entries.sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
  return entries[0] ?? null;
}

function buildAuditInput(sessionRecord, input) {
  return createAuditEvent({
    ...input,
    ...createAuditActor(sessionRecord),
  });
}

export async function saveDocumentForSession(sessionRecord, scope, state) {
  const projectId = state?.ui?.activeProjectId || state?.document?.id || '';
  const slotKey = getDocumentSlotKey(sessionRecord, scope, projectId);
  const record = {
    id: slotKey,
    scope,
    clientId: sessionRecord.activeClientId,
    userId: sessionRecord.user.id,
    projectId: projectId || undefined,
    updatedAt: nowIso(),
    state,
  };
  await documentRepository.upsertDocumentSlot(record);
  sessionRecord.db ??= {};
  sessionRecord.db.documentSlots ??= {};
  if (sessionRecord.db?.documentSlots) {
    sessionRecord.db.documentSlots[slotKey] = record;
  }
  await documentRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: scope === 'manual' ? 'document.manual.save' : 'document.autosave.save',
    target: 'document',
    targetId: slotKey,
    summary: `${sessionRecord.user.name} saved ${scope} draft`,
    metadata: { projectId: projectId || undefined },
  }));
  return record;
}

export async function loadDocumentForSession(sessionRecord, scope) {
  const record = await resolveDocumentRecord(sessionRecord, scope);
  return record?.state ?? null;
}

export async function hasDocumentForSession(sessionRecord, scope) {
  return Boolean(await resolveDocumentRecord(sessionRecord, scope));
}

export async function clearDocumentForSession(sessionRecord, scope) {
  const removed = await documentRepository.deleteDocumentSlots({
    scope,
    clientId: sessionRecord.activeClientId,
    userId: sessionRecord.user.id,
  });
  if (sessionRecord.db?.documentSlots && removed.length) {
    for (const entry of removed) {
      delete sessionRecord.db.documentSlots[entry.id];
    }
  }
  await documentRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: scope === 'manual' ? 'document.manual.clear' : 'document.autosave.clear',
    target: 'document',
    summary: `${sessionRecord.user.name} cleared ${scope} draft`,
    metadata: { scope },
  }));
}

export async function cleanupStaleDocumentSlots(sessionRecord, { maxAgeDays, scope } = {}) {
  if (sessionRecord.user.role !== 'admin') {
    throw new Error('Forbidden: draft cleanup requires admin access');
  }
  const normalizedScope = String(scope || '').trim();
  const retentionDays = Math.max(1, Number(maxAgeDays) || 14);
  const cutoffIso = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000)).toISOString();
  const removed = await documentRepository.deleteDocumentSlots({
    scope: normalizedScope || undefined,
    before: cutoffIso,
  });

  await documentRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'document.cleanup',
    target: 'document',
    summary: `${sessionRecord.user.name} pruned ${removed.length} stale drafts`,
    metadata: {
      removedCount: removed.length,
      maxAgeDays: retentionDays,
      scope: normalizedScope || undefined,
    },
  }));

  if (sessionRecord.db?.documentSlots && removed.length) {
    for (const entry of removed) {
      delete sessionRecord.db.documentSlots[entry.id];
    }
  }

  return {
    ok: true,
    removedCount: removed.length,
    removed: removed.map((entry) => ({
      id: entry.id,
      scope: entry.scope,
      updatedAt: entry.updatedAt,
    })),
    maxAgeDays: retentionDays,
    scope: normalizedScope || null,
  };
}

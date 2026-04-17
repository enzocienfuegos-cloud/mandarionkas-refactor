import { randomUUID } from 'node:crypto';
import { auditRepository } from '../contracts/audit-repository.mjs';

function nowIso() {
  return new Date().toISOString();
}

export function createAuditEvent(input) {
  return {
    id: randomUUID(),
    action: String(input.action || 'unknown'),
    target: String(input.target || 'unknown'),
    actorUserId: input.actorUserId || undefined,
    actorName: input.actorName || undefined,
    clientId: input.clientId || undefined,
    targetId: input.targetId || undefined,
    summary: String(input.summary || 'Audit event'),
    at: input.at || nowIso(),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : undefined,
  };
}

export function appendAuditEvent(db, input) {
  db.auditEvents ??= [];
  const event = createAuditEvent(input);
  db.auditEvents = [event, ...db.auditEvents].slice(0, 500);
  return event;
}

export function createAuditActor(sessionRecord) {
  return {
    actorUserId: sessionRecord?.user?.id,
    actorName: sessionRecord?.user?.name,
    clientId: sessionRecord?.activeClientId,
  };
}

export async function listAuditEventsForSession(sessionRecord, options = {}) {
  if (sessionRecord.user.role !== 'admin') {
    throw new Error('Forbidden: audit inspection requires admin access');
  }
  return auditRepository.listAuditEvents(options);
}

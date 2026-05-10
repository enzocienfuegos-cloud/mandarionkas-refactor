import { randomUUID } from 'node:crypto';
import { createEmptyDb } from '../server/data/db-shape.mjs';

function nowIso() {
  return new Date().toISOString();
}

export function createDemoSeed() {
  const adminId = 'usr_admin';
  const editorId = 'usr_editor';
  const reviewerId = 'usr_reviewer';
  const defaultClientId = 'client_default';
  return {
    ...createEmptyDb(),
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
  };
}

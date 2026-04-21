import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/server.mjs';
import { createPool } from '../../../packages/db/src/pool.mjs';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeIfDatabase = hasDatabase ? describe : describe.skip;

function extractCookies(response) {
  const raw = response.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function mergeCookieJar(existing, response) {
  const next = new Map(existing);
  for (const cookie of extractCookies(response)) {
    const [pair] = cookie.split(';');
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    next.set(name, value);
  }
  return next;
}

function cookieHeader(jar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function json(response) {
  return JSON.parse(response.body);
}

describeIfDatabase('auth/session integration — invite -> register -> activate -> session', () => {
  let app;
  let pool;
  const cleanup = {
    workspaceIds: new Set(),
    emails: new Set(),
  };

  before(async () => {
    app = await buildApp();
    pool = createPool();
  });

  after(async () => {
    if (pool) {
      for (const workspaceId of cleanup.workspaceIds) {
        await pool.query('DELETE FROM workspaces WHERE id = $1', [workspaceId]);
      }
      if (cleanup.emails.size > 0) {
        await pool.query(
          'DELETE FROM users WHERE lower(email) = ANY($1::text[])',
          [Array.from(cleanup.emails)],
        );
      }
      await pool.end();
    }
    if (app) {
      await app.close();
    }
  });

  it('activates pending invite on registration and restores a real session', async () => {
    const suffix = randomUUID().slice(0, 8);
    const ownerEmail = `owner.integration.${suffix}@example.com`;
    const inviteeEmail = `invitee.integration.${suffix}@example.com`;
    cleanup.emails.add(ownerEmail);
    cleanup.emails.add(inviteeEmail);

    let ownerCookies = new Map();

    const registerOwner = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: ownerEmail,
        password: 'OwnerPass123!',
        firstName: 'Owner',
        lastName: 'Integration',
        workspaceName: `Integration Workspace ${suffix}`,
      },
    });

    assert.equal(registerOwner.statusCode, 201);
    ownerCookies = mergeCookieJar(ownerCookies, registerOwner);
    const ownerPayload = await json(registerOwner);
    const workspaceId = ownerPayload.workspace.id;
    cleanup.workspaceIds.add(workspaceId);

    const inviteMember = await app.inject({
      method: 'POST',
      url: '/v1/team/invite',
      headers: { cookie: cookieHeader(ownerCookies) },
      payload: {
        email: inviteeEmail,
        role: 'member',
      },
    });

    assert.equal(inviteMember.statusCode, 201);

    const pendingMembership = await pool.query(
      `SELECT status, role
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1 AND lower(u.email) = lower($2)`,
      [workspaceId, inviteeEmail],
    );
    assert.equal(pendingMembership.rows[0]?.status, 'pending');
    assert.equal(pendingMembership.rows[0]?.role, 'member');

    const pendingInvite = await pool.query(
      `SELECT status, role
       FROM studio_invites
       WHERE workspace_id = $1 AND lower(email) = lower($2)`,
      [workspaceId, inviteeEmail],
    );
    assert.equal(pendingInvite.rows[0]?.status, 'pending');
    assert.equal(pendingInvite.rows[0]?.role, 'editor');

    let inviteeCookies = new Map();
    const registerInvitee = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: inviteeEmail,
        password: 'InviteePass123!',
        firstName: 'Invitee',
        lastName: 'Integration',
      },
    });

    assert.equal(registerInvitee.statusCode, 201);
    inviteeCookies = mergeCookieJar(inviteeCookies, registerInvitee);
    const inviteePayload = await json(registerInvitee);
    assert.equal(inviteePayload.workspace.id, workspaceId);

    const activeMembership = await pool.query(
      `SELECT status, joined_at
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1 AND lower(u.email) = lower($2)`,
      [workspaceId, inviteeEmail],
    );
    assert.equal(activeMembership.rows[0]?.status, 'active');
    assert.ok(activeMembership.rows[0]?.joined_at);

    const acceptedInvite = await pool.query(
      `SELECT status, accepted_at
       FROM studio_invites
       WHERE workspace_id = $1 AND lower(email) = lower($2)`,
      [workspaceId, inviteeEmail],
    );
    assert.equal(acceptedInvite.rows[0]?.status, 'accepted');
    assert.ok(acceptedInvite.rows[0]?.accepted_at);

    const restoreSession = await app.inject({
      method: 'GET',
      url: '/v1/auth/session',
      headers: { cookie: cookieHeader(inviteeCookies) },
    });

    assert.equal(restoreSession.statusCode, 200);
    const sessionPayload = await json(restoreSession);
    assert.equal(sessionPayload.authenticated, true);
    assert.equal(sessionPayload.activeWorkspaceId, workspaceId);
    assert.equal(sessionPayload.activeClientId, workspaceId);
    assert.equal(sessionPayload.user.email, inviteeEmail);
    assert.equal(sessionPayload.user.role, 'editor');
    assert.equal(sessionPayload.clients.length, 1);
    assert.equal(sessionPayload.clients[0].id, workspaceId);

    const listedWorkspaces = await app.inject({
      method: 'GET',
      url: '/v1/auth/workspaces',
      headers: { cookie: cookieHeader(inviteeCookies) },
    });

    assert.equal(listedWorkspaces.statusCode, 200);
    const workspacesPayload = await json(listedWorkspaces);
    assert.equal(workspacesPayload.workspaces.length, 1);
    assert.equal(workspacesPayload.workspaces[0].id, workspaceId);
  });
});

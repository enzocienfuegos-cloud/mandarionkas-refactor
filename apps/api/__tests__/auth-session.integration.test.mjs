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

  it('supports client -> project -> asset lifecycle on the real API', async () => {
    const suffix = randomUUID().slice(0, 8);
    const ownerEmail = `owner.lifecycle.${suffix}@example.com`;
    cleanup.emails.add(ownerEmail);

    let cookies = new Map();
    const registerOwner = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: ownerEmail,
        password: 'OwnerPass123!',
        firstName: 'Lifecycle',
        lastName: 'Owner',
        workspaceName: `Lifecycle Root ${suffix}`,
      },
    });

    assert.equal(registerOwner.statusCode, 201);
    cookies = mergeCookieJar(cookies, registerOwner);
    const registerPayload = await json(registerOwner);
    cleanup.workspaceIds.add(registerPayload.workspace.id);

    const createClient = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      headers: { cookie: cookieHeader(cookies) },
      payload: { name: `Lifecycle Client ${suffix}` },
    });

    assert.equal(createClient.statusCode, 200);
    cookies = mergeCookieJar(cookies, createClient);
    const createClientPayload = await json(createClient);
    const clientId = createClientPayload.client.id;
    cleanup.workspaceIds.add(clientId);
    assert.equal(createClientPayload.activeClientId, clientId);

    const createBrand = await app.inject({
      method: 'POST',
      url: `/v1/clients/${clientId}/brands`,
      headers: { cookie: cookieHeader(cookies) },
      payload: {
        name: `Lifecycle Brand ${suffix}`,
        primaryColor: '#0ea5e9',
      },
    });

    assert.equal(createBrand.statusCode, 200);
    const createBrandPayload = await json(createBrand);
    const brand = createBrandPayload.client.brands.find((item) => item.name === `Lifecycle Brand ${suffix}`);
    assert.ok(brand);

    const state = {
      document: {
        id: randomUUID(),
        name: `Lifecycle Project ${suffix}`,
        canvas: { presetId: 'display-standard' },
        metadata: {
          platform: {
            brandId: brand.id,
            brandName: brand.name,
            campaignName: `Campaign ${suffix}`,
            accessScope: 'client',
          },
        },
        scenes: [{ id: randomUUID(), widgetIds: [randomUUID(), randomUUID()] }],
      },
      ui: {},
    };

    const saveProject = await app.inject({
      method: 'POST',
      url: '/v1/projects/save',
      headers: { cookie: cookieHeader(cookies) },
      payload: { state },
    });

    assert.equal(saveProject.statusCode, 200);
    const saveProjectPayload = await json(saveProject);
    const projectId = saveProjectPayload.project.id;
    assert.equal(saveProjectPayload.project.workspaceId, clientId);
    assert.equal(saveProjectPayload.project.name, state.document.name);

    const listProjects = await app.inject({
      method: 'GET',
      url: '/v1/projects',
      headers: { cookie: cookieHeader(cookies) },
    });

    assert.equal(listProjects.statusCode, 200);
    const listProjectsPayload = await json(listProjects);
    assert.ok(listProjectsPayload.projects.some((project) => project.id === projectId));

    const saveVersion = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/versions`,
      headers: { cookie: cookieHeader(cookies) },
      payload: {
        state,
        note: 'Initial approved version',
      },
    });

    assert.equal(saveVersion.statusCode, 200);
    const saveVersionPayload = await json(saveVersion);
    assert.equal(saveVersionPayload.version.projectId, projectId);
    assert.equal(saveVersionPayload.version.versionNumber, 1);

    const listVersions = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}/versions`,
      headers: { cookie: cookieHeader(cookies) },
    });

    assert.equal(listVersions.statusCode, 200);
    const listVersionsPayload = await json(listVersions);
    assert.equal(listVersionsPayload.versions.length, 1);

    const createFolder = await app.inject({
      method: 'POST',
      url: '/v1/assets/folders',
      headers: { cookie: cookieHeader(cookies) },
      payload: { name: `Lifecycle Folder ${suffix}` },
    });

    assert.equal(createFolder.statusCode, 200);
    const createFolderPayload = await json(createFolder);
    const folderId = createFolderPayload.folder.id;

    const createAsset = await app.inject({
      method: 'POST',
      url: '/v1/assets',
      headers: { cookie: cookieHeader(cookies) },
      payload: {
        asset: {
          name: `Lifecycle Asset ${suffix}`,
          kind: 'image',
          src: `https://cdn.example.com/${suffix}.png`,
          mimeType: 'image/png',
          accessScope: 'client',
          tags: ['integration'],
        },
      },
    });

    assert.equal(createAsset.statusCode, 200);
    const createAssetPayload = await json(createAsset);
    const assetId = createAssetPayload.asset.id;
    assert.equal(createAssetPayload.asset.folderId ?? null, null);

    const moveAsset = await app.inject({
      method: 'POST',
      url: `/v1/assets/${assetId}/move`,
      headers: { cookie: cookieHeader(cookies) },
      payload: { folderId },
    });

    assert.equal(moveAsset.statusCode, 200);
    const moveAssetPayload = await json(moveAsset);
    assert.equal(moveAssetPayload.asset.folderId, folderId);

    const listAssets = await app.inject({
      method: 'GET',
      url: '/v1/assets',
      headers: { cookie: cookieHeader(cookies) },
    });

    assert.equal(listAssets.statusCode, 200);
    const listAssetsPayload = await json(listAssets);
    const movedAsset = listAssetsPayload.assets.find((asset) => asset.id === assetId);
    assert.equal(movedAsset.folderId, folderId);

    const deleteAsset = await app.inject({
      method: 'DELETE',
      url: `/v1/assets/${assetId}`,
      headers: { cookie: cookieHeader(cookies) },
    });
    assert.equal(deleteAsset.statusCode, 204);

    const deleteFolder = await app.inject({
      method: 'DELETE',
      url: `/v1/assets/folders/${folderId}`,
      headers: { cookie: cookieHeader(cookies) },
    });
    assert.equal(deleteFolder.statusCode, 204);

    const deleteProject = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}`,
      headers: { cookie: cookieHeader(cookies) },
    });
    assert.equal(deleteProject.statusCode, 204);
  });

  it('supports invite -> studio login -> active client switch across multiple clients', async () => {
    const suffix = randomUUID().slice(0, 8);
    const ownerEmail = `owner.switch.${suffix}@example.com`;
    const inviteeEmail = `invitee.switch.${suffix}@example.com`;
    cleanup.emails.add(ownerEmail);
    cleanup.emails.add(inviteeEmail);

    let ownerCookies = new Map();
    const registerOwner = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: ownerEmail,
        password: 'OwnerPass123!',
        firstName: 'Switch',
        lastName: 'Owner',
        workspaceName: `Zulu Client ${suffix}`,
      },
    });

    assert.equal(registerOwner.statusCode, 201);
    ownerCookies = mergeCookieJar(ownerCookies, registerOwner);
    const ownerPayload = await json(registerOwner);
    const zuluClientId = ownerPayload.workspace.id;
    cleanup.workspaceIds.add(zuluClientId);

    const createAlphaClient = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      headers: { cookie: cookieHeader(ownerCookies) },
      payload: { name: `Alpha Client ${suffix}` },
    });

    assert.equal(createAlphaClient.statusCode, 200);
    ownerCookies = mergeCookieJar(ownerCookies, createAlphaClient);
    const alphaPayload = await json(createAlphaClient);
    const alphaClientId = alphaPayload.client.id;
    cleanup.workspaceIds.add(alphaClientId);

    const inviteToZulu = await app.inject({
      method: 'POST',
      url: `/v1/clients/${zuluClientId}/invites`,
      headers: { cookie: cookieHeader(ownerCookies) },
      payload: {
        email: inviteeEmail,
        role: 'editor',
      },
    });
    assert.equal(inviteToZulu.statusCode, 200);

    const inviteToAlpha = await app.inject({
      method: 'POST',
      url: `/v1/clients/${alphaClientId}/invites`,
      headers: { cookie: cookieHeader(ownerCookies) },
      payload: {
        email: inviteeEmail,
        role: 'reviewer',
      },
    });
    assert.equal(inviteToAlpha.statusCode, 200);

    let inviteeCookies = new Map();
    const registerInvitee = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: inviteeEmail,
        password: 'InviteePass123!',
        firstName: 'Switch',
        lastName: 'Invitee',
      },
    });

    assert.equal(registerInvitee.statusCode, 201);
    inviteeCookies = mergeCookieJar(inviteeCookies, registerInvitee);

    const sessionAfterRegister = await app.inject({
      method: 'GET',
      url: '/v1/auth/session',
      headers: {
        cookie: cookieHeader(inviteeCookies),
        origin: 'https://studio-staging.duskplatform.co',
      },
    });

    assert.equal(sessionAfterRegister.statusCode, 200);
    const sessionAfterRegisterPayload = await json(sessionAfterRegister);
    assert.equal(sessionAfterRegisterPayload.authenticated, true);
    assert.equal(sessionAfterRegisterPayload.clients.length, 2);
    assert.equal(sessionAfterRegisterPayload.activeClientId, alphaClientId);

    inviteeCookies = new Map();
    const studioLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { origin: 'https://studio-staging.duskplatform.co' },
      payload: {
        email: inviteeEmail,
        password: 'InviteePass123!',
      },
    });

    assert.equal(studioLogin.statusCode, 200);
    inviteeCookies = mergeCookieJar(inviteeCookies, studioLogin);
    const studioLoginPayload = await json(studioLogin);
    assert.equal(studioLoginPayload.authenticated, true);
    assert.equal(studioLoginPayload.clients.length, 2);
    assert.equal(studioLoginPayload.activeClientId, alphaClientId);

    const switchClient = await app.inject({
      method: 'POST',
      url: '/v1/clients/active',
      headers: {
        cookie: cookieHeader(inviteeCookies),
        origin: 'https://studio-staging.duskplatform.co',
      },
      payload: {
        clientId: zuluClientId,
      },
    });

    assert.equal(switchClient.statusCode, 200);
    const switchClientPayload = await json(switchClient);
    assert.equal(switchClientPayload.ok, true);
    assert.equal(switchClientPayload.activeClientId, zuluClientId);
    assert.equal(switchClientPayload.activeWorkspaceId, zuluClientId);

    const sessionAfterSwitch = await app.inject({
      method: 'GET',
      url: '/v1/auth/session',
      headers: {
        cookie: cookieHeader(inviteeCookies),
        origin: 'https://studio-staging.duskplatform.co',
      },
    });

    assert.equal(sessionAfterSwitch.statusCode, 200);
    const sessionAfterSwitchPayload = await json(sessionAfterSwitch);
    assert.equal(sessionAfterSwitchPayload.activeClientId, zuluClientId);
    assert.equal(sessionAfterSwitchPayload.activeWorkspaceId, zuluClientId);
    assert.equal(sessionAfterSwitchPayload.user.role, 'editor');
  });
});

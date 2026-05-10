import { badRequest, forbidden, sendJson, sendNoContent } from '../../lib/http.mjs';
import { hasPermission, withSession } from '../../lib/session.mjs';
import { recordAuditEvent } from '@smx/db/src/audit.mjs';
import {
  createBrandKit,
  deleteBrandKit,
  getBrandKitById,
  listBrandKitsForWorkspace,
  updateBrandKit,
} from './service.mjs';

function getActiveWorkspace(session) {
  return session.workspaces.find((workspace) => workspace.id === session.session.activeWorkspaceId) || session.workspaces[0] || null;
}

function getPayload(body) {
  return body?.brandKit && typeof body.brandKit === 'object' ? body.brandKit : body;
}

export async function handleBrandKitRoutes(ctx) {
  const { method, pathname, res, requestId, body } = ctx;

  if (method === 'GET' && pathname === '/v1/brand-kits') {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      if (!workspace) return sendJson(res, 200, { brandKits: [] });
      const brandKits = await listBrandKitsForWorkspace(session.client, workspace.id);
      return sendJson(res, 200, { brandKits, requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/brand-kits\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return sendJson(res, 404, { brandKit: null, requestId, code: 'brand_kit_not_found', message: 'Brand Kit not found.' });
      }
      const brandKitId = pathname.split('/')[3];
      const brandKit = await getBrandKitById(session.client, { brandKitId, workspaceId: workspace.id });
      if (!brandKit) {
        return sendJson(res, 404, { brandKit: null, requestId, code: 'brand_kit_not_found', message: 'Brand Kit not found.' });
      }
      return sendJson(res, 200, { brandKit, requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/brand-kits') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'brandkits:manage')) {
        return forbidden(res, requestId, 'You do not have permission to manage Brand Kits.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return badRequest(res, requestId, 'An active workspace is required to create a Brand Kit.');
      }
      try {
        await session.client.query('begin');
        const brandKit = await createBrandKit(session.client, {
          workspaceId: workspace.id,
          input: getPayload(body),
        });
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'brandkit.created',
          targetType: 'brand_kit',
          targetId: brandKit.id,
          payload: { name: brandKit.name },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { brandKit, requestId });
      } catch (error) {
        await session.client.query('rollback');
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'PUT' && /^\/v1\/brand-kits\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'brandkits:manage')) {
        return forbidden(res, requestId, 'You do not have permission to manage Brand Kits.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return badRequest(res, requestId, 'An active workspace is required to update a Brand Kit.');
      }
      const brandKitId = pathname.split('/')[3];
      try {
        await session.client.query('begin');
        const brandKit = await updateBrandKit(session.client, {
          brandKitId,
          workspaceId: workspace.id,
          input: getPayload(body),
        });
        if (!brandKit) {
          await session.client.query('rollback');
          return sendJson(res, 404, { brandKit: null, requestId, code: 'brand_kit_not_found', message: 'Brand Kit not found.' });
        }
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'brandkit.updated',
          targetType: 'brand_kit',
          targetId: brandKit.id,
          payload: { name: brandKit.name },
        });
        await session.client.query('commit');
        return sendJson(res, 200, { brandKit, requestId });
      } catch (error) {
        try { await session.client.query('rollback'); } catch {}
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /^\/v1\/brand-kits\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'brandkits:manage')) {
        return forbidden(res, requestId, 'You do not have permission to manage Brand Kits.');
      }
      const workspace = getActiveWorkspace(session);
      if (!workspace) {
        return badRequest(res, requestId, 'An active workspace is required to delete a Brand Kit.');
      }
      const brandKitId = pathname.split('/')[3];
      try {
        await session.client.query('begin');
        const deleted = await deleteBrandKit(session.client, { brandKitId, workspaceId: workspace.id });
        if (!deleted) {
          await session.client.query('rollback');
          return sendJson(res, 404, { ok: false, requestId, code: 'brand_kit_not_found', message: 'Brand Kit not found.' });
        }
        await recordAuditEvent(session.client, {
          workspaceId: workspace.id,
          actorUserId: session.user.id,
          action: 'brandkit.deleted',
          targetType: 'brand_kit',
          targetId: brandKitId,
        });
        await session.client.query('commit');
        return sendNoContent(res);
      } catch (error) {
        try { await session.client.query('rollback'); } catch {}
        return badRequest(res, requestId, error.message);
      }
    });
  }

  return false;
}

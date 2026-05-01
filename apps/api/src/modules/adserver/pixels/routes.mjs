import { badRequest, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { withSession, hasPermission } from '../../../lib/session.mjs';
import { getTagById } from '@smx/db/src/tags.mjs';
import { createTagPixel, deleteTagPixel, listTagPixels, updateTagPixel } from '@smx/db/src/pixels.mjs';


async function resolveTagWorkspaceId(client, userId, tagId) {
  const tag = await getTagById(client, tagId);
  if (!tag) {
    const error = new Error('Tag not found.');
    error.statusCode = 404;
    throw error;
  }
  const { rowCount } = await client.query(
    `select 1 from workspace_members where workspace_id = $1 and user_id = $2 limit 1`,
    [tag.workspace_id, userId],
  );
  if (!rowCount) {
    const error = new Error('You do not have access to this tag.');
    error.statusCode = 403;
    throw error;
  }
  return tag.workspace_id;
}

function normalizePixel(row) {
  return {
    id: row.id,
    tagId: row.tag_id,
    pixelType: row.pixel_type,
    url: row.url,
    createdAt: row.created_at?.toISOString?.() || row.created_at || null,
  };
}

export async function handlePixelRoutes(ctx) {
  const { method, pathname, body, res, requestId } = ctx;

  if (method === 'GET' && /^\/v1\/tags\/[^/]+\/pixels$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const tagId = pathname.split('/')[3];
      try {
        const workspaceId = await resolveTagWorkspaceId(session.client, session.user.id, tagId);
        const pixels = await listTagPixels(session.client, { workspaceId, tagId });
        return sendJson(res, 200, { ok: true, requestId, pixels: pixels.map(normalizePixel) });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'POST' && /^\/v1\/tags\/[^/]+\/pixels$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to manage pixels.');
      }
      const tagId = pathname.split('/')[3];
      try {
        const workspaceId = await resolveTagWorkspaceId(session.client, session.user.id, tagId);
        const pixel = await createTagPixel(session.client, {
          workspaceId,
          tagId,
          pixelType: body?.pixelType ?? body?.pixel_type,
          url: body?.url,
        });
        if (!pixel) return badRequest(res, requestId, 'Tag not found.');
        return sendJson(res, 201, { ok: true, requestId, pixel: normalizePixel(pixel) });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'PUT' && /^\/v1\/tags\/[^/]+\/pixels\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to manage pixels.');
      }
      const [, , , tagId, , pixelId] = pathname.split('/');
      try {
        const workspaceId = await resolveTagWorkspaceId(session.client, session.user.id, tagId);
        const pixel = await updateTagPixel(session.client, {
          workspaceId,
          tagId,
          pixelId,
          pixelType: body?.pixelType ?? body?.pixel_type,
          url: body?.url,
        });
        if (!pixel) return badRequest(res, requestId, 'Pixel not found.');
        return sendJson(res, 200, { ok: true, requestId, pixel: normalizePixel(pixel) });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /^\/v1\/tags\/[^/]+\/pixels\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to manage pixels.');
      }
      const [, , , tagId, , pixelId] = pathname.split('/');
      try {
        const workspaceId = await resolveTagWorkspaceId(session.client, session.user.id, tagId);
        const deleted = await deleteTagPixel(session.client, { workspaceId, tagId, pixelId });
        if (!deleted) return badRequest(res, requestId, 'Pixel not found.');
        return sendJson(res, 200, { ok: true, requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  return false;
}

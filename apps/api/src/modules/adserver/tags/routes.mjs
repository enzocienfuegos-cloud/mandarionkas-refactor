import { badRequest, conflict, forbidden, sendJson, serviceUnavailable, unauthorized } from '../../../lib/http.mjs';
import { requireAuthenticatedSession } from '../../auth/service.mjs';
import { checkTagHealth, getTagHealthSummary, listTagHealth } from '../../../../../../packages/db/src/tag-health.mjs';
import { getTagStats, getTagSummary } from '../../../../../../packages/db/src/reporting.mjs';
import { listTagBindings as listCreativeTagBindings, updateTagBinding as updateCreativeTagBinding } from '../../../../../../packages/db/src/creatives.mjs';
import {
  createTag,
  deleteTag,
  getTag,
  getTagById,
  listTags,
  listTagsForUser,
  updateTag,
} from '../../../../../../packages/db/src/tags.mjs';

function hasPermission(session, permission) {
  return session.permissions.includes(permission);
}

async function withSession(ctx, callback) {
  const session = await requireAuthenticatedSession({ env: ctx.env, headers: ctx.req.headers });
  if (!session.ok) {
    if (session.statusCode === 503) return serviceUnavailable(ctx.res, ctx.requestId, session.message);
    if (session.statusCode === 401) return unauthorized(ctx.res, ctx.requestId, session.message);
    return false;
  }
  try {
    return await callback(session);
  } finally {
    await session.finish();
  }
}

async function resolveTargetWorkspaceId(client, userId, fallbackWorkspaceId, requestedWorkspaceId) {
  const candidate = String(requestedWorkspaceId ?? '').trim();
  if (!candidate) return fallbackWorkspaceId;
  const { rowCount } = await client.query(
    `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
    [candidate, userId],
  );
  if (!rowCount) {
    const error = new Error('Not a member of the selected client');
    error.statusCode = 403;
    throw error;
  }
  return candidate;
}

function normalizeTag(row) {
  if (!row) return null;
  const normalizedFormat = String(row.format ?? '').toLowerCase() === 'vast' ? 'VAST' : row.format;
  return {
    ...row,
    workspaceId: row.workspace_id ?? null,
    workspaceName: row.workspace_name ?? null,
    campaignId: row.campaign_id ?? null,
    campaign: row.campaign_id ? { id: row.campaign_id, name: row.campaign_name ?? '' } : null,
    clickUrl: row.click_url ?? '',
    impressionUrl: row.impression_url ?? '',
    description: row.description ?? '',
    targeting: row.targeting ?? {},
    frequencyCap: row.frequency_cap ?? null,
    frequencyCapWindow: row.frequency_cap_window ?? null,
    geoTargets: row.geo_targets ?? [],
    deviceTargets: row.device_targets ?? [],
    servingWidth: row.serving_width || null,
    servingHeight: row.serving_height || null,
    trackerType: row.tracker_type ?? null,
    sizeLabel: String(normalizedFormat).toLowerCase() === 'tracker'
      ? (row.tracker_type === 'impression' ? '1x1' : '')
      : (row.serving_width && row.serving_height ? `${row.serving_width}x${row.serving_height}` : ''),
    format: normalizedFormat,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseTagInput(body = {}) {
  return {
    workspaceId: body.workspaceId ?? body.workspace_id ?? null,
    campaign_id: body.campaignId ?? body.campaign_id ?? null,
    name: String(body.name || '').trim(),
    format: body.format ? String(body.format).trim().toLowerCase() : undefined,
    status: body.status ? String(body.status).trim().toLowerCase() : undefined,
    click_url: body.clickUrl ?? body.click_url ?? null,
    impression_url: body.impressionUrl ?? body.impression_url ?? null,
    description: body.description ?? null,
    targeting: body.targeting && typeof body.targeting === 'object' ? body.targeting : {},
    frequency_cap: body.frequencyCap ?? body.frequency_cap ?? null,
    frequency_cap_window: body.frequencyCapWindow ?? body.frequency_cap_window ?? null,
    geo_targets: body.geoTargets ?? body.geo_targets ?? [],
    device_targets: body.deviceTargets ?? body.device_targets ?? [],
    serving_width: body.servingWidth ?? body.serving_width ?? null,
    serving_height: body.servingHeight ?? body.serving_height ?? null,
    tracker_type: body.trackerType ?? body.tracker_type ?? null,
  };
}

function normalizeTagBinding(row) {
  if (!row) return null;
  return {
    id: row.id,
    tagId: row.tag_id,
    creativeId: row.creative_id,
    creativeVersionId: row.creative_version_id,
    creativeSizeVariantId: row.creative_size_variant_id ?? null,
    status: row.status,
    weight: Number(row.weight || 1),
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creativeName: row.creative_name ?? '',
    creativeVersionStatus: row.creative_version_status ?? '',
    sourceKind: row.source_kind ?? '',
    servingFormat: row.serving_format ?? '',
    publicUrl: row.public_url ?? null,
    entryPath: row.entry_path ?? null,
    variantLabel: row.variant_label ?? '',
    variantWidth: row.variant_width ?? null,
    variantHeight: row.variant_height ?? null,
    variantStatus: row.variant_status ?? null,
  };
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function handleTagRoutes(ctx) {
  const { method, pathname, body, res, requestId, url } = ctx;

  if (method === 'GET' && pathname === '/v1/tags') {
    return withSession(ctx, async (session) => {
      const scope = url.searchParams.get('scope');
      const workspaceFilter = url.searchParams.get('workspaceId') || url.searchParams.get('clientId');
      const tags = scope === 'all'
        ? await listTagsForUser(session.client, session.user.id, {
          workspaceId: workspaceFilter,
          status: url.searchParams.get('status'),
          format: url.searchParams.get('format'),
          campaignId: url.searchParams.get('campaignId'),
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
          search: url.searchParams.get('search'),
        })
        : await listTags(session.client, session.session.activeWorkspaceId, {
          status: url.searchParams.get('status'),
          format: url.searchParams.get('format'),
          campaignId: url.searchParams.get('campaignId'),
          limit: url.searchParams.get('limit'),
          offset: url.searchParams.get('offset'),
          search: url.searchParams.get('search'),
        });
      return sendJson(res, 200, { tags: tags.map(normalizeTag), requestId });
    });
  }

  if (method === 'GET' && pathname === '/v1/tags/health') {
    return withSession(ctx, async (session) => {
      const activeWorkspaceId = session.session.activeWorkspaceId;
      const tags = await listTags(session.client, activeWorkspaceId, { limit: 500 });
      for (const tag of tags) {
        await checkTagHealth(session.client, activeWorkspaceId, tag.id);
      }
      const healthRows = await listTagHealth(session.client, activeWorkspaceId, {
        status: url.searchParams.get('status'),
        limit: url.searchParams.get('limit'),
        offset: url.searchParams.get('offset'),
      });
      return sendJson(res, 200, {
        tags: healthRows.map((row) => ({
          id: row.tag_id,
          name: row.tag_name,
          status: row.status,
          lastImpression: row.last_impression_at,
          impressions24h: Number(row.impression_count_24h || 0),
          errorRate: Number(row.error_rate || 0) * 100,
        })),
        requestId,
      });
    });
  }

  if (method === 'GET' && pathname === '/v1/tags/health/summary') {
    return withSession(ctx, async (session) => {
      const summary = await getTagHealthSummary(session.client, session.session.activeWorkspaceId);
      return sendJson(res, 200, {
        healthy: Number(summary.healthy_count || 0),
        warning: Number(summary.warning_count || 0),
        critical: Number(summary.critical_count || 0),
        unknown: Number(summary.unknown_count || 0),
        requestId,
      });
    });
  }

  if (method === 'GET' && /^\/v1\/tags\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const baseTag = await getTagById(session.client, id);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        baseTag.workspace_id,
      );
      const tag = await getTag(session.client, workspaceId, id);
      return sendJson(res, 200, { tag: normalizeTag(tag), requestId });
    });
  }

  if (method === 'POST' && pathname === '/v1/tags') {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:create')) {
        return forbidden(res, requestId, 'You do not have permission to create tags.');
      }
      const input = parseTagInput(body);
      if (!input.name) return badRequest(res, requestId, 'Tag name is required.');
      try {
        const workspaceId = await resolveTargetWorkspaceId(
          session.client,
          session.user.id,
          session.session.activeWorkspaceId,
          input.workspaceId,
        );
        const tag = await createTag(session.client, workspaceId, input);
        return sendJson(res, 201, { tag: normalizeTag(tag), requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'PUT' && /^\/v1\/tags\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update tags.');
      }
      const id = pathname.split('/')[3];
      const baseTag = await getTagById(session.client, id);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const input = parseTagInput(body);
      try {
        const workspaceId = await resolveTargetWorkspaceId(
          session.client,
          session.user.id,
          session.session.activeWorkspaceId,
          input.workspaceId || baseTag.workspace_id,
        );
        const tag = await updateTag(session.client, workspaceId, id, input);
        return sendJson(res, 200, { tag: normalizeTag(tag), requestId });
      } catch (error) {
        return badRequest(res, requestId, error.message);
      }
    });
  }

  if (method === 'DELETE' && /^\/v1\/tags\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:delete')) {
        return forbidden(res, requestId, 'You do not have permission to delete tags.');
      }
      const id = pathname.split('/')[3];
      const baseTag = await getTagById(session.client, id);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const workspaceId = await resolveTargetWorkspaceId(
        session.client,
        session.user.id,
        session.session.activeWorkspaceId,
        baseTag.workspace_id,
      );
      const deleted = await deleteTag(session.client, workspaceId, id);
      if (!deleted) return badRequest(res, requestId, 'Tag not found.');
      res.statusCode = 204;
      res.end();
      return true;
    });
  }

  if (method === 'GET' && /^\/v1\/tags\/[^/]+\/bindings$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const baseTag = await getTagById(session.client, id);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const bindings = await listCreativeTagBindings(session.client, baseTag.workspace_id, id);
      return sendJson(res, 200, { bindings: bindings.map(normalizeTagBinding), requestId });
    });
  }

  if (method === 'PATCH' && /^\/v1\/tags\/[^/]+\/bindings\/[^/]+$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      if (!hasPermission(session, 'projects:save')) {
        return forbidden(res, requestId, 'You do not have permission to update tag bindings.');
      }
      const [, , , tagId, , bindingId] = pathname.split('/');
      const baseTag = await getTagById(session.client, tagId);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const binding = await updateCreativeTagBinding(session.client, baseTag.workspace_id, tagId, bindingId, {
        status: body?.status,
        weight: body?.weight,
      });
      if (!binding) return badRequest(res, requestId, 'Tag binding not found.');
      return sendJson(res, 200, { binding: normalizeTagBinding(binding), requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/tags\/[^/]+\/delivery-diagnostics$/.test(pathname)) {
    return withSession(ctx, async () => sendJson(res, 200, { deliveryDiagnostics: {}, requestId }));
  }

  if (method === 'GET' && /^\/v1\/tags\/[^/]+\/export$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const baseTag = await getTagById(session.client, id);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const tag = normalizeTag(baseTag);
      const csv = [
        ['tag_id', 'tag_name', 'format', 'status', 'campaign_name', 'size_label', 'tracker_type'],
        [tag.id, tag.name, tag.format, tag.status, tag.campaign?.name ?? '', tag.sizeLabel ?? '', tag.trackerType ?? ''],
      ].map((row) => row.map(escapeCsv).join(',')).join('\n');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tag.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tag.csv"`);
      res.end(csv);
      return true;
    });
  }

  if (method === 'GET' && /^\/v1\/tags\/[^/]+\/summary$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const baseTag = await getTagById(session.client, id);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const summary = await getTagSummary(session.client, baseTag.workspace_id, id, {
        dateFrom: url.searchParams.get('dateFrom'),
        dateTo: url.searchParams.get('dateTo'),
      });
      return sendJson(res, 200, { summary, requestId });
    });
  }

  if (method === 'GET' && /^\/v1\/tags\/[^/]+\/stats$/.test(pathname)) {
    return withSession(ctx, async (session) => {
      const id = pathname.split('/')[3];
      const baseTag = await getTagById(session.client, id);
      if (!baseTag) return badRequest(res, requestId, 'Tag not found.');
      const stats = await getTagStats(session.client, baseTag.workspace_id, id, {
        dateFrom: url.searchParams.get('dateFrom'),
        dateTo: url.searchParams.get('dateTo'),
        limit: url.searchParams.get('limit'),
      });
      return sendJson(res, 200, { stats, requestId });
    });
  }

  return false;
}

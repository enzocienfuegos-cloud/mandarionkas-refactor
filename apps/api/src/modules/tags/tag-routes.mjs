import {
  listTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  getTagWithCreatives,
} from '@smx/db/tags';
import { listTagBindings, updateTagBinding } from '@smx/db';

function getRequestBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  if (proto && host) return `${proto}://${host}`.replace(/\/+$/, '');
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, '');
  return `https://${req.hostname}`.replace(/\/+$/, '');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildTagSnippet(baseUrl, tag, variant) {
  const width = Number(tag.serving_width ?? 0) || 300;
  const height = Number(tag.serving_height ?? 0) || 250;
  const displayJsUrl = `${baseUrl}/v1/tags/display/${tag.id}.js`;
  const displayHtmlUrl = `${baseUrl}/v1/tags/display/${tag.id}.html`;
  const vastUrl = `${baseUrl}/v1/vast/tags/${tag.id}`;
  switch (variant) {
    case 'display-js':
      return `<script src="${displayJsUrl}" async></script>\n<noscript>\n  <iframe src="${displayHtmlUrl}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="border:0;overflow:hidden;"></iframe>\n</noscript>`;
    case 'display-ins':
      return `<ins id="smx-ad-slot-${tag.id}" style="display:inline-block;width:${width}px;height:${height}px;"></ins>\n<script>\n  (function(slot) {\n    if (!slot) return;\n    var iframe = document.createElement('iframe');\n    iframe.src = ${JSON.stringify(displayHtmlUrl)};\n    iframe.width = ${JSON.stringify(String(width))};\n    iframe.height = ${JSON.stringify(String(height))};\n    iframe.scrolling = 'no';\n    iframe.frameBorder = '0';\n    iframe.style.border = '0';\n    iframe.style.overflow = 'hidden';\n    slot.replaceWith(iframe);\n  })(document.getElementById(${JSON.stringify(`smx-ad-slot-${tag.id}`)}));\n</script>`;
    case 'display-iframe':
      return `<iframe\n  src="${displayHtmlUrl}"\n  width="${width}"\n  height="${height}"\n  scrolling="no"\n  frameborder="0"\n  marginwidth="0"\n  marginheight="0"\n  style="border:0;overflow:hidden;"\n></iframe>`;
    case 'vast-url':
      return vastUrl;
    default:
      return '';
  }
}

function toApiTag(tag) {
  if (!tag) return null;
  const servingWidth = Number(tag.serving_width ?? 0) || null;
  const servingHeight = Number(tag.serving_height ?? 0) || null;
  return {
    id: tag.id,
    name: tag.name,
    campaignId: tag.campaign_id ?? null,
    campaign: tag.campaign_id ? { id: tag.campaign_id, name: tag.campaign_name ?? '' } : null,
    format: tag.format === 'vast' ? 'VAST' : tag.format,
    status: tag.status,
    clickUrl: tag.click_url ?? '',
    impressionUrl: tag.impression_url ?? '',
    description: tag.description ?? '',
    targeting: tag.targeting ?? {},
    frequencyCap: tag.frequency_cap ?? null,
    frequencyCapWindow: tag.frequency_cap_window ?? null,
    geoTargets: tag.geo_targets ?? [],
    deviceTargets: tag.device_targets ?? [],
    servingWidth,
    servingHeight,
    sizeLabel: servingWidth && servingHeight ? `${servingWidth}x${servingHeight}` : '',
    createdAt: tag.created_at,
    updatedAt: tag.updated_at,
    creatives: Array.isArray(tag.creatives) ? tag.creatives : undefined,
  };
}

export function handleTagRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/tags
  app.get('/v1/tags', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { campaignId, format, status, limit, offset, search } = req.query;

    const tags = await listTags(pool, workspaceId, {
      campaignId,
      format,
      status,
      limit,
      offset,
      search,
    });

    return reply.send({ tags: tags.map(toApiTag) });
  });

  // POST /v1/tags
  app.post('/v1/tags', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const {
      name,
      campaignId,
      format,
      status,
      clickUrl,
      impressionUrl,
      description,
      targeting,
      frequencyCap,
      frequencyCapWindow,
      geoTargets,
      deviceTargets,
      servingWidth,
      servingHeight,
    } = req.body ?? {};

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const tag = await createTag(pool, workspaceId, {
      name,
      campaign_id: campaignId,
      format,
      status,
      click_url: clickUrl,
      impression_url: impressionUrl,
      description,
      targeting,
      frequency_cap: frequencyCap,
      frequency_cap_window: frequencyCapWindow,
      geo_targets: geoTargets,
      device_targets: deviceTargets,
      serving_width: servingWidth ?? null,
      serving_height: servingHeight ?? null,
    });

    return reply.status(201).send({ tag: toApiTag(tag) });
  });

  // GET /v1/tags/:id/export
  app.get('/v1/tags/:id/export', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.format, t.status,
              w.name AS workspace_name,
              c.name AS campaign_name,
              COALESCE(tfc.display_width, bound_sizes.serving_width, legacy_sizes.serving_width) AS serving_width,
              COALESCE(tfc.display_height, bound_sizes.serving_height, legacy_sizes.serving_height) AS serving_height
       FROM ad_tags t
       JOIN workspaces w ON w.id = t.workspace_id
       LEFT JOIN campaigns c ON c.id = t.campaign_id
       LEFT JOIN tag_format_configs tfc
         ON tfc.workspace_id = t.workspace_id
        AND tfc.tag_id = t.id
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(csv.width, cv.width) AS serving_width,
           COALESCE(csv.height, cv.height) AS serving_height
         FROM tag_bindings tb
         JOIN creative_versions cv ON cv.id = tb.creative_version_id
         LEFT JOIN creative_size_variants csv ON csv.id = tb.creative_size_variant_id
         WHERE tb.workspace_id = t.workspace_id
           AND tb.tag_id = t.id
           AND tb.status IN ('active', 'draft')
         ORDER BY tb.weight DESC, tb.created_at ASC
         LIMIT 1
       ) bound_sizes ON TRUE
       LEFT JOIN LATERAL (
         SELECT cr.width AS serving_width, cr.height AS serving_height
         FROM tag_creatives tc
         JOIN creatives cr ON cr.id = tc.creative_id
         WHERE tc.tag_id = t.id
         ORDER BY tc.weight DESC, tc.created_at ASC
         LIMIT 1
       ) legacy_sizes ON TRUE
       WHERE t.workspace_id = $1
         AND t.id = $2
       LIMIT 1`,
      [workspaceId, id],
    );
    const tag = rows[0];
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const size = tag.serving_width && tag.serving_height ? `${tag.serving_width}x${tag.serving_height}` : '';
    const format = String(tag.format ?? '').toLowerCase();
    const baseUrl = getRequestBaseUrl(req);
    const csvRows = [
      ['client', 'campaign', 'tag_name', 'format', 'size', 'js_tag', 'ins_tag', 'iframe_tag', 'vast_url'],
      [
        tag.workspace_name ?? '',
        tag.campaign_name ?? '',
        tag.name,
        format === 'vast' ? 'VAST' : format,
        size,
        format === 'display' ? buildTagSnippet(baseUrl, tag, 'display-js') : '',
        format === 'display' ? buildTagSnippet(baseUrl, tag, 'display-ins') : '',
        format === 'display' ? buildTagSnippet(baseUrl, tag, 'display-iframe') : '',
        format === 'vast' ? buildTagSnippet(baseUrl, tag, 'vast-url') : '',
      ],
    ];

    const csv = csvRows.map(row => row.map(escapeCsv).join(',')).join('\n');
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename=\"${tag.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tag.csv\"`)
      .send(csv);
  });

  // GET /v1/tags/:id
  app.get('/v1/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const tag = await getTagWithCreatives(pool, workspaceId, id);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.send({ tag: toApiTag(tag) });
  });

  // GET /v1/tags/:id/bindings
  app.get('/v1/tags/:id/bindings', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const tag = await getTag(pool, workspaceId, id);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const bindings = await listTagBindings(pool, workspaceId, id, {
      status: req.query?.status,
    });

    return reply.send({
      bindings: bindings.map(binding => ({
        id: binding.id,
        tagId: binding.tag_id,
        creativeVersionId: binding.creative_version_id,
        creativeSizeVariantId: binding.creative_size_variant_id ?? null,
        status: binding.status,
        weight: binding.weight,
        startAt: binding.start_at ?? null,
        endAt: binding.end_at ?? null,
        createdBy: binding.created_by ?? null,
        createdAt: binding.created_at,
        updatedAt: binding.updated_at,
        creativeName: binding.creative_name ?? '',
        creativeVersionStatus: binding.creative_version_status ?? '',
        sourceKind: binding.source_kind ?? '',
        servingFormat: binding.serving_format ?? '',
        publicUrl: binding.public_url ?? '',
        entryPath: binding.entry_path ?? '',
        variantLabel: binding.variant_label ?? '',
        variantWidth: binding.variant_width ?? null,
        variantHeight: binding.variant_height ?? null,
        variantStatus: binding.variant_status ?? '',
      })),
    });
  });

  // PATCH /v1/tags/:id/bindings/:bindingId
  app.patch('/v1/tags/:id/bindings/:bindingId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id, bindingId } = req.params;
    const tag = await getTag(pool, workspaceId, id);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const binding = await updateTagBinding(pool, workspaceId, bindingId, {
      status: req.body?.status,
      weight: req.body?.weight,
      start_at: req.body?.startAt,
      end_at: req.body?.endAt,
    });

    if (!binding || binding.tag_id !== id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Binding not found' });
    }

    return reply.send({
      binding: {
        id: binding.id,
        tagId: binding.tag_id,
        creativeVersionId: binding.creative_version_id,
        creativeSizeVariantId: binding.creative_size_variant_id ?? null,
        status: binding.status,
        weight: binding.weight,
        startAt: binding.start_at ?? null,
        endAt: binding.end_at ?? null,
        createdBy: binding.created_by ?? null,
        createdAt: binding.created_at,
        updatedAt: binding.updated_at,
      },
    });
  });

  // PUT /v1/tags/:id
  app.put('/v1/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    // Map camelCase to snake_case for the DB layer
    const data = {};
    const fieldMap = {
      name: 'name',
      campaignId: 'campaign_id',
      format: 'format',
      status: 'status',
      clickUrl: 'click_url',
      impressionUrl: 'impression_url',
      description: 'description',
      targeting: 'targeting',
      frequencyCap: 'frequency_cap',
      frequencyCapWindow: 'frequency_cap_window',
      geoTargets: 'geo_targets',
      deviceTargets: 'device_targets',
      servingWidth: 'serving_width',
      servingHeight: 'serving_height',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) data[snake] = body[camel];
    }

    const tag = await updateTag(pool, workspaceId, id, data);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.send({ tag: toApiTag(tag) });
  });

  // DELETE /v1/tags/:id
  app.delete('/v1/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteTag(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    return reply.status(204).send();
  });
}

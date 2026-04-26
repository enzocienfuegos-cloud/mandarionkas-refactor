const VALID_STATUSES = ['draft', 'active', 'paused', 'archived'];
const VALID_FORMATS  = ['vast', 'display', 'native', 'tracker'];

function normalizeTagFormat(format) {
  if (!format) return null;
  const normalized = String(format).trim().toLowerCase();
  if (normalized === 'vast_video') return 'vast';
  return VALID_FORMATS.includes(normalized) ? normalized : null;
}

function normalizeTagStatus(status) {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  return VALID_STATUSES.includes(normalized) ? normalized : null;
}

export async function listTags(pool, workspaceId, opts = {}) {
  const { status, format, campaignId, limit = 100, offset = 0, search } = opts;
  const params = [workspaceId];
  const conditions = ['t.workspace_id = $1'];

  if (status) {
    params.push(normalizeTagStatus(status) ?? status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (format) {
    params.push(normalizeTagFormat(format) ?? format);
    conditions.push(`t.format = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  if (search && search.trim().length >= 2) {
    params.push(search.trim());
    conditions.push(`t.search_vec @@ websearch_to_tsquery('english', $${params.length})`);
  }

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT t.id, t.workspace_id, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.tag_code, t.description,
            t.targeting, t.frequency_cap, t.frequency_cap_window,
            t.geo_targets, t.device_targets, t.created_at, t.updated_at,
            c.name AS campaign_name,
            assigned_creatives.assigned_count,
            assigned_creatives.assigned_names,
            COALESCE(tfc.display_width, bound_sizes.serving_width, legacy_sizes.serving_width) AS serving_width,
            COALESCE(tfc.display_height, bound_sizes.serving_height, legacy_sizes.serving_height) AS serving_height,
            tfc.tracker_type
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS assigned_count,
         string_agg(assigned.name, ', ' ORDER BY assigned.sort_weight DESC, assigned.created_at ASC) AS assigned_names
       FROM (
         SELECT cr.name, tb.weight AS sort_weight, tb.created_at
         FROM tag_bindings tb
         JOIN creative_versions cv2 ON cv2.id = tb.creative_version_id
         JOIN creatives cr ON cr.id = cv2.creative_id
         WHERE tb.workspace_id = t.workspace_id
           AND tb.tag_id = t.id
           AND tb.status IN ('active', 'draft', 'paused')
         UNION ALL
         SELECT cr.name, tc.weight AS sort_weight, tc.created_at
         FROM tag_creatives tc
         JOIN creatives cr ON cr.id = tc.creative_id
         WHERE tc.tag_id = t.id
       ) assigned
     ) assigned_creatives ON TRUE
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
       SELECT
         c.width AS serving_width,
         c.height AS serving_height
       FROM tag_creatives tc
       JOIN creatives c ON c.id = tc.creative_id
       WHERE tc.tag_id = t.id
       ORDER BY tc.weight DESC, tc.created_at ASC
       LIMIT 1
     ) legacy_sizes ON TRUE
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function listTagsForUser(pool, userId, opts = {}) {
  const { status, format, campaignId, workspaceId, limit = 100, offset = 0, search } = opts;
  const params = [userId];
  const conditions = ["wm.user_id = $1", "wm.status = 'active'"];

  if (workspaceId) {
    params.push(workspaceId);
    conditions.push(`t.workspace_id = $${params.length}`);
  }
  if (status) {
    params.push(normalizeTagStatus(status) ?? status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (format) {
    params.push(normalizeTagFormat(format) ?? format);
    conditions.push(`t.format = $${params.length}`);
  }
  if (campaignId) {
    params.push(campaignId);
    conditions.push(`t.campaign_id = $${params.length}`);
  }
  if (search && search.trim().length >= 2) {
    params.push(search.trim());
    conditions.push(`t.search_vec @@ websearch_to_tsquery('english', $${params.length})`);
  }

  params.push(Math.min(Number(limit) || 100, 500));
  params.push(Number(offset) || 0);

  const { rows } = await pool.query(
    `SELECT t.id, t.workspace_id, w.name AS workspace_name, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.tag_code, t.description,
            t.targeting, t.frequency_cap, t.frequency_cap_window,
            t.geo_targets, t.device_targets, t.created_at, t.updated_at,
            c.name AS campaign_name,
            assigned_creatives.assigned_count,
            assigned_creatives.assigned_names,
            COALESCE(tfc.display_width, bound_sizes.serving_width, legacy_sizes.serving_width) AS serving_width,
            COALESCE(tfc.display_height, bound_sizes.serving_height, legacy_sizes.serving_height) AS serving_height,
            tfc.tracker_type
     FROM ad_tags t
     JOIN workspace_members wm ON wm.workspace_id = t.workspace_id
     JOIN workspaces w ON w.id = t.workspace_id
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS assigned_count,
         string_agg(assigned.name, ', ' ORDER BY assigned.sort_weight DESC, assigned.created_at ASC) AS assigned_names
       FROM (
         SELECT cr.name, tb.weight AS sort_weight, tb.created_at
         FROM tag_bindings tb
         JOIN creative_versions cv2 ON cv2.id = tb.creative_version_id
         JOIN creatives cr ON cr.id = cv2.creative_id
         WHERE tb.workspace_id = t.workspace_id
           AND tb.tag_id = t.id
           AND tb.status IN ('active', 'draft', 'paused')
         UNION ALL
         SELECT cr.name, tc.weight AS sort_weight, tc.created_at
         FROM tag_creatives tc
         JOIN creatives cr ON cr.id = tc.creative_id
         WHERE tc.tag_id = t.id
       ) assigned
     ) assigned_creatives ON TRUE
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
       SELECT
         c.width AS serving_width,
         c.height AS serving_height
       FROM tag_creatives tc
       JOIN creatives c ON c.id = tc.creative_id
       WHERE tc.tag_id = t.id
       ORDER BY tc.weight DESC, tc.created_at ASC
       LIMIT 1
     ) legacy_sizes ON TRUE
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

export async function getTag(pool, workspaceId, tagId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.workspace_id, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.tag_code, t.description,
            t.targeting, t.frequency_cap, t.frequency_cap_window,
            t.geo_targets, t.device_targets, t.created_at, t.updated_at, c.name AS campaign_name,
            COALESCE(tfc.display_width, bound_sizes.serving_width, legacy_sizes.serving_width) AS serving_width,
            COALESCE(tfc.display_height, bound_sizes.serving_height, legacy_sizes.serving_height) AS serving_height,
            tfc.tracker_type
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
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
       SELECT
         c.width AS serving_width,
         c.height AS serving_height
       FROM tag_creatives tc
       JOIN creatives c ON c.id = tc.creative_id
       WHERE tc.tag_id = t.id
       ORDER BY tc.weight DESC, tc.created_at ASC
       LIMIT 1
     ) legacy_sizes ON TRUE
     WHERE t.workspace_id = $1 AND t.id = $2`,
    [workspaceId, tagId],
  );
  return rows[0] ?? null;
}

export async function getTagById(pool, tagId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.workspace_id, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.tag_code, t.description,
            t.targeting, t.frequency_cap, t.frequency_cap_window,
            t.geo_targets, t.device_targets, t.created_at, t.updated_at, c.name AS campaign_name,
            COALESCE(tfc.display_width, bound_sizes.serving_width, legacy_sizes.serving_width) AS serving_width,
            COALESCE(tfc.display_height, bound_sizes.serving_height, legacy_sizes.serving_height) AS serving_height,
            tfc.tracker_type
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
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
       SELECT
         c.width AS serving_width,
         c.height AS serving_height
       FROM tag_creatives tc
       JOIN creatives c ON c.id = tc.creative_id
       WHERE tc.tag_id = t.id
       ORDER BY tc.weight DESC, tc.created_at ASC
       LIMIT 1
     ) legacy_sizes ON TRUE
     WHERE t.id = $1`,
    [tagId],
  );
  return rows[0] ?? null;
}

export async function createTag(pool, workspaceId, data) {
  const {
    campaign_id = null, name, format = 'display', status = 'active',
    click_url = null, impression_url = null, tag_code = null,
    description = null, targeting = {}, frequency_cap = null,
    frequency_cap_window = null, geo_targets = [], device_targets = [],
    serving_width = null, serving_height = null, tracker_type = null,
  } = data;

  const normalizedFormat = normalizeTagFormat(format) ?? 'display';
  const normalizedStatus = normalizeTagStatus(status) ?? 'active';

  const { rows } = await pool.query(
    `INSERT INTO ad_tags
       (workspace_id, campaign_id, name, format, status, click_url, impression_url,
        tag_code, description, targeting, frequency_cap, frequency_cap_window,
        geo_targets, device_targets)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [workspaceId, campaign_id, name, normalizedFormat, normalizedStatus, click_url, impression_url,
     tag_code, description, JSON.stringify(targeting), frequency_cap,
     frequency_cap_window, geo_targets, device_targets],
  );
  const tag = rows[0];

  if (normalizedFormat === 'display' && (serving_width || serving_height)) {
    await pool.query(
      `INSERT INTO tag_format_configs (tag_id, display_width, display_height, tracker_type)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (tag_id)
       DO UPDATE SET
         display_width = EXCLUDED.display_width,
         display_height = EXCLUDED.display_height,
         updated_at = NOW()`,
      [tag.id, serving_width ?? null, serving_height ?? null],
    );
  }

  if (normalizedFormat === 'tracker' && tracker_type) {
    await pool.query(
      `INSERT INTO tag_format_configs (tag_id, display_width, display_height, tracker_type)
       VALUES ($1, NULL, NULL, $2)
       ON CONFLICT (tag_id)
       DO UPDATE SET
         display_width = NULL,
         display_height = NULL,
         tracker_type = EXCLUDED.tracker_type,
         updated_at = NOW()`,
      [tag.id, tracker_type],
    );
  }

  return getTag(pool, workspaceId, tag.id);
}

export async function updateTag(pool, workspaceId, tagId, data) {
  const allowed = [
    'campaign_id', 'name', 'format', 'status', 'click_url', 'impression_url',
    'tag_code', 'description', 'targeting', 'frequency_cap', 'frequency_cap_window',
    'geo_targets', 'device_targets',
  ];
  const setClauses = [];
  const params = [workspaceId, tagId];
  for (const key of allowed) {
    if (key in data) {
      let value = data[key];
      if (key === 'targeting') value = JSON.stringify(value);
      if (key === 'format') value = normalizeTagFormat(value) ?? value;
      if (key === 'status') value = normalizeTagStatus(value) ?? value;
      params.push(value);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getTag(pool, workspaceId, tagId);

  setClauses.push(`updated_at = NOW()`);
  const { rows } = await pool.query(
    `UPDATE ad_tags SET ${setClauses.join(', ')}
     WHERE workspace_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  const tag = rows[0] ?? null;
  if (!tag) return null;

  if ('serving_width' in data || 'serving_height' in data || 'format' in data || 'tracker_type' in data) {
    const nextFormat = normalizeTagFormat(data.format ?? tag.format) ?? tag.format;
    if (nextFormat === 'display') {
      await pool.query(
        `INSERT INTO tag_format_configs (tag_id, display_width, display_height, tracker_type)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT (tag_id)
         DO UPDATE SET
           display_width = COALESCE(EXCLUDED.display_width, tag_format_configs.display_width),
           display_height = COALESCE(EXCLUDED.display_height, tag_format_configs.display_height),
           updated_at = NOW()`,
        [
          tagId,
          'serving_width' in data ? (data.serving_width ?? null) : null,
          'serving_height' in data ? (data.serving_height ?? null) : null,
        ],
      );
    } else if (nextFormat === 'tracker') {
      await pool.query(
        `INSERT INTO tag_format_configs (tag_id, display_width, display_height, tracker_type)
         VALUES ($1, NULL, NULL, $2)
         ON CONFLICT (tag_id)
         DO UPDATE SET
           display_width = NULL,
           display_height = NULL,
           tracker_type = COALESCE(EXCLUDED.tracker_type, tag_format_configs.tracker_type),
           updated_at = NOW()`,
        [
          tagId,
          'tracker_type' in data ? (data.tracker_type ?? null) : null,
        ],
      );
    }
  }

  return getTag(pool, workspaceId, tagId);
}

export async function deleteTag(pool, workspaceId, tagId) {
  const { rowCount } = await pool.query(
    `DELETE FROM ad_tags WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, tagId],
  );
  return rowCount > 0;
}

export async function getTagWithCreatives(pool, workspaceId, tagId) {
  const tag = await getTag(pool, workspaceId, tagId);
  if (!tag) return null;

  const { rows: creatives } = await pool.query(
    `SELECT c.id, c.name, c.type, c.file_url, c.width, c.height, c.duration_ms,
            c.approval_status, c.transcode_status, c.click_url,
            tc.weight, tc.created_at AS assigned_at
     FROM tag_creatives tc
     JOIN creatives c ON c.id = tc.creative_id
     WHERE tc.tag_id = $1
     ORDER BY tc.weight DESC, tc.created_at ASC`,
    [tagId],
  );
  return { ...tag, creatives };
}

export async function getTagWithCreativesById(pool, tagId) {
  const tag = await getTagById(pool, tagId);
  if (!tag) return null;

  const { rows: creatives } = await pool.query(
    `SELECT c.id, c.name, c.type, c.file_url, c.width, c.height, c.duration_ms,
            c.approval_status, c.transcode_status, c.click_url,
            tc.weight, tc.created_at AS assigned_at
     FROM tag_creatives tc
     JOIN creatives c ON c.id = tc.creative_id
     WHERE tc.tag_id = $1
     ORDER BY tc.weight DESC, tc.created_at ASC`,
    [tagId],
  );
  return { ...tag, creatives };
}

function isServingVersionEligible(version) {
  return ['approved', 'draft'].includes(String(version?.status ?? '').toLowerCase());
}

function isBindingActive(binding) {
  const status = String(binding?.status ?? '').toLowerCase();
  if (!['active', 'draft'].includes(status)) return false;

  const now = Date.now();
  const startAt = binding?.start_at ? new Date(binding.start_at).getTime() : null;
  const endAt = binding?.end_at ? new Date(binding.end_at).getTime() : null;
  if (startAt && startAt > now) return false;
  if (endAt && endAt < now) return false;
  return true;
}

function normalizeRequestedSize(requestedSize = {}) {
  if (!requestedSize || typeof requestedSize !== 'object') {
    return null;
  }
  const width = Number(requestedSize.width);
  const height = Number(requestedSize.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  return { width, height };
}

function scoreBindingForRequestedSize(binding, requestedSize) {
  const requested = normalizeRequestedSize(requestedSize);
  if (!requested) return 0;

  const width = Number(binding.variant_width ?? binding.width ?? 0);
  const height = Number(binding.variant_height ?? binding.height ?? 0);
  if (!width || !height) return 25;

  if (width === requested.width && height === requested.height) {
    return 1000;
  }

  const requestedAspect = requested.width / requested.height;
  const candidateAspect = width / height;
  const aspectDelta = Math.abs(requestedAspect - candidateAspect);
  const areaDelta = Math.abs((requested.width * requested.height) - (width * height));
  const orientationBonus =
    (requested.width >= requested.height) === (width >= height)
      ? 40
      : 0;

  return Math.max(
    0,
    700
      - Math.round(aspectDelta * 200)
      - Math.round(areaDelta / 5000)
      + orientationBonus,
  );
}

function scoreArtifactForServing(servingFormat, artifact) {
  const kind = String(artifact?.kind ?? '').toLowerCase();
  if (servingFormat === 'vast_video') {
    if (kind === 'video_mp4') return 100;
    if (kind === 'published_asset') return 80;
    if (kind === 'legacy_asset') return 60;
  }
  if (servingFormat === 'display_html') {
    if (kind === 'published_html') return 100;
    if (kind === 'published_asset') return 70;
    if (kind === 'legacy_asset') return 50;
  }
  if (servingFormat === 'display_image') {
    if (kind === 'published_asset') return 100;
    if (kind === 'legacy_asset') return 80;
    if (kind === 'thumbnail') return 40;
  }
  return 0;
}

function pickArtifactForBinding(binding) {
  const artifacts = Array.isArray(binding?.artifacts) ? binding.artifacts : [];
  const servingFormat = String(binding?.serving_format ?? '').toLowerCase();
  const viable = artifacts
    .filter(artifact => artifact?.public_url)
    .map(artifact => ({ artifact, score: scoreArtifactForServing(servingFormat, artifact) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return viable[0]?.artifact ?? null;
}

function pickPreferredVideoRendition(binding) {
  const renditions = Array.isArray(binding?.video_renditions) ? binding.video_renditions : [];
  const eligible = renditions
    .filter((rendition) => rendition?.public_url && ['active', 'draft', 'paused'].includes(String(rendition?.status ?? '').toLowerCase()))
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  return eligible[0] ?? null;
}

function toServingCandidateFromBinding(binding, tag) {
  const artifact = pickArtifactForBinding(binding);
  const preferredVideoRendition = String(binding?.serving_format ?? '').toLowerCase() === 'vast_video'
    ? pickPreferredVideoRendition(binding)
    : null;
  const publicUrl = preferredVideoRendition?.public_url ?? artifact?.public_url ?? binding.variant_public_url ?? binding.public_url ?? null;
  const versionMetadata = binding.version_metadata && typeof binding.version_metadata === 'object'
    ? binding.version_metadata
    : {};
  const clickOverrideEnabled = Boolean(tag.click_url);
  const clickUrl = tag.click_url ?? binding.creative_click_url ?? null;
  const internalClickSignals = Array.isArray(versionMetadata.internalClickSignals)
    ? versionMetadata.internalClickSignals.filter(Boolean)
    : [];
  const hasInternalClickTag = Boolean(
    versionMetadata.hasInternalClickTag
    || versionMetadata.hasEmbeddedClickTag,
  );
  if (!publicUrl && binding.serving_format !== 'display_html') {
    return null;
  }

  return {
    source: 'binding',
    creativeId: binding.creative_id,
    creativeVersionId: binding.creative_version_id,
    creativeSizeVariantId: binding.creative_size_variant_id ?? null,
    creativeName: binding.creative_name ?? '',
    servingFormat: binding.serving_format,
    width: preferredVideoRendition?.width ?? binding.variant_width ?? binding.width ?? null,
    height: preferredVideoRendition?.height ?? binding.variant_height ?? binding.height ?? null,
    durationMs: binding.duration_ms ?? null,
    mimeType: preferredVideoRendition?.mime_type ?? artifact?.mime_type ?? binding.mime_type ?? null,
    clickUrl,
    clickOverrideEnabled,
    hasInternalClickTag,
    internalClickSignals,
    publicUrl,
    videoRenditions: Array.isArray(binding?.video_renditions) ? binding.video_renditions : [],
    entryPath: binding.entry_path ?? null,
    artifactKind: artifact?.kind ?? null,
    sourceKind: binding.source_kind ?? null,
    status: binding.creative_version_status ?? null,
  };
}

function toServingCandidateFromLegacy(creative, tag) {
  if (!creative) return null;
  return {
    source: 'legacy',
    creativeId: creative.id,
    creativeVersionId: null,
    creativeName: creative.name ?? '',
    servingFormat: creative.type === 'video' || creative.type === 'vast' ? 'vast_video' : 'display_image',
    width: creative.width ?? null,
    height: creative.height ?? null,
    durationMs: creative.duration_ms ?? null,
    mimeType: null,
    clickUrl: tag.click_url ?? creative.click_url ?? null,
    publicUrl: creative.file_url ?? null,
    entryPath: null,
    artifactKind: 'legacy_asset',
    sourceKind: 'legacy',
    status: creative.approval_status ?? null,
  };
}

async function listTagVersionBindings(pool, workspaceId, tagId) {
  const { rows } = await pool.query(
    `SELECT
        tb.id,
        tb.tag_id,
        tb.creative_version_id,
        tb.creative_size_variant_id,
        tb.status,
        tb.weight,
        tb.start_at,
        tb.end_at,
        tb.created_at,
        cv.id AS version_id,
        cv.creative_id,
        cv.source_kind,
        cv.serving_format,
        cv.status AS creative_version_status,
        cv.public_url,
        cv.entry_path,
        cv.metadata AS version_metadata,
        cv.mime_type,
        cv.width,
        cv.height,
        cv.duration_ms,
        c.name AS creative_name,
        c.click_url AS creative_click_url,
        csv.label AS variant_label,
        csv.width AS variant_width,
        csv.height AS variant_height,
        csv.status AS variant_status,
        csv.public_url AS variant_public_url,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ca.id,
              'kind', ca.kind,
              'public_url', ca.public_url,
              'mime_type', ca.mime_type,
              'size_bytes', ca.size_bytes,
              'checksum', ca.checksum,
              'metadata', ca.metadata
            )
            ORDER BY ca.created_at DESC
          ) FILTER (WHERE ca.id IS NOT NULL),
          '[]'::json
          ) AS artifacts
       ,
       COALESCE(
         (
           SELECT json_agg(
             json_build_object(
               'id', vr.id,
               'label', vr.label,
               'width', vr.width,
               'height', vr.height,
               'bitrate_kbps', vr.bitrate_kbps,
               'codec', vr.codec,
               'mime_type', vr.mime_type,
               'status', vr.status,
               'is_source', vr.is_source,
               'sort_order', vr.sort_order,
               'public_url', ca2.public_url,
               'storage_key', ca2.storage_key,
               'size_bytes', ca2.size_bytes,
               'metadata', vr.metadata
             )
             ORDER BY vr.sort_order ASC, vr.created_at ASC
           )
           FROM video_renditions vr
           LEFT JOIN creative_artifacts ca2
             ON ca2.id = vr.artifact_id
            AND ca2.workspace_id = vr.workspace_id
           WHERE vr.workspace_id = tb.workspace_id
             AND vr.creative_version_id = cv.id
         ),
         '[]'::json
       ) AS video_renditions
     FROM tag_bindings tb
     JOIN creative_versions cv ON cv.id = tb.creative_version_id
     JOIN creatives c ON c.id = cv.creative_id
     LEFT JOIN creative_size_variants csv ON csv.id = tb.creative_size_variant_id
     LEFT JOIN creative_artifacts ca ON ca.creative_version_id = cv.id
     WHERE tb.workspace_id = $1
       AND tb.tag_id = $2
     GROUP BY
       tb.id, tb.tag_id, tb.creative_version_id, tb.creative_size_variant_id, tb.status, tb.weight, tb.start_at, tb.end_at, tb.created_at,
       cv.id, cv.creative_id, cv.source_kind, cv.serving_format, cv.status, cv.public_url, cv.entry_path, cv.metadata,
       cv.mime_type, cv.width, cv.height, cv.duration_ms,
       c.name, c.click_url,
       csv.label, csv.width, csv.height, csv.status, csv.public_url
     ORDER BY tb.weight DESC, tb.created_at ASC`,
    [workspaceId, tagId],
  );
  return rows;
}

function hashRotationSeed(value) {
  const input = String(value ?? '');
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) + input.charCodeAt(index);
    hash >>>= 0;
  }
  return hash >>> 0;
}

function selectServingBinding(bindings, requestedSize, rotationSeed = '') {
  const eligibleBindings = bindings.filter(binding =>
    isBindingActive(binding)
    && isServingVersionEligible({ status: binding.creative_version_status }),
  );

  if (!eligibleBindings.length) return null;
  const pickWeightedBinding = (candidates) => {
    if (!candidates.length) return null;
    const normalizedCandidates = candidates.map((binding) => ({
      binding,
      weightScore: Math.max(1, Number(binding.weight) || 1),
    }));
    const totalWeight = normalizedCandidates.reduce((sum, candidate) => sum + candidate.weightScore, 0);
    if (totalWeight <= 0) {
      return normalizedCandidates[0]?.binding ?? null;
    }

    const normalizedSeed = String(rotationSeed ?? '').trim();
    let roll = normalizedSeed
      ? (hashRotationSeed(normalizedSeed) % totalWeight)
      : (Math.random() * totalWeight);
    for (const candidate of normalizedCandidates) {
      roll -= candidate.weightScore;
      if (roll <= 0) return candidate.binding;
    }

    return normalizedCandidates[normalizedCandidates.length - 1]?.binding ?? null;
  };

  const requested = normalizeRequestedSize(requestedSize);
  if (!requested) {
    return pickWeightedBinding(eligibleBindings);
  }

  const ranked = eligibleBindings
    .map(binding => ({
      binding,
      sizeScore: scoreBindingForRequestedSize(binding, requested),
      weightScore: Math.max(1, Number(binding.weight) || 1),
      hasVariant: Boolean(binding.creative_size_variant_id),
    }))
    .sort((a, b) => {
      if (b.sizeScore !== a.sizeScore) return b.sizeScore - a.sizeScore;
      if (b.hasVariant !== a.hasVariant) return Number(b.hasVariant) - Number(a.hasVariant);
      if (b.weightScore !== a.weightScore) return b.weightScore - a.weightScore;
      return new Date(a.binding.created_at).getTime() - new Date(b.binding.created_at).getTime();
    });

  const bestSizeScore = ranked[0]?.sizeScore ?? null;
  const bestVariantMatch = ranked[0]?.hasVariant ?? null;
  const topTierBindings = ranked
    .filter(candidate => candidate.sizeScore === bestSizeScore && candidate.hasVariant === bestVariantMatch)
    .map(candidate => candidate.binding);

  return pickWeightedBinding(topTierBindings);
}

export async function getTagServingSnapshot(pool, workspaceId, tagId, options = {}) {
  const tag = await getTag(pool, workspaceId, tagId);
  if (!tag) return null;

  const [bindings, legacyTag] = await Promise.all([
    listTagVersionBindings(pool, workspaceId, tagId),
    getTagWithCreatives(pool, workspaceId, tagId),
  ]);

  const activeBinding = selectServingBinding(bindings, options.requestedSize, options.rotationSeed);
  const servingCandidate = activeBinding
    ? toServingCandidateFromBinding(activeBinding, tag)
    : null;

  if (servingCandidate) {
    return { ...tag, creatives: legacyTag?.creatives ?? [], bindings, servingCandidate };
  }

  const legacyCreative =
    legacyTag?.creatives?.find(c => c.approval_status === 'approved' && (c.file_url || c.click_url))
    ?? legacyTag?.creatives?.[0]
    ?? null;

  return {
    ...tag,
    creatives: legacyTag?.creatives ?? [],
    bindings,
    servingCandidate: toServingCandidateFromLegacy(legacyCreative, tag),
  };
}

export async function getTagServingSnapshotById(pool, tagId, options = {}) {
  const tag = await getTagById(pool, tagId);
  if (!tag) return null;

  const workspaceId = tag.workspace_id;
  const [bindings, legacyTag] = await Promise.all([
    listTagVersionBindings(pool, workspaceId, tagId),
    getTagWithCreativesById(pool, tagId),
  ]);

  const activeBinding = selectServingBinding(bindings, options.requestedSize, options.rotationSeed);
  const servingCandidate = activeBinding
    ? toServingCandidateFromBinding(activeBinding, tag)
    : null;

  if (servingCandidate) {
    return { ...tag, creatives: legacyTag?.creatives ?? [], bindings, servingCandidate };
  }

  const legacyCreative =
    legacyTag?.creatives?.find(c => c.approval_status === 'approved' && (c.file_url || c.click_url))
    ?? legacyTag?.creatives?.[0]
    ?? null;

  return {
    ...tag,
    creatives: legacyTag?.creatives ?? [],
    bindings,
    servingCandidate: toServingCandidateFromLegacy(legacyCreative, tag),
  };
}

export async function listTagIdsByCreativeVersion(pool, workspaceId, creativeVersionId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT tag_id
     FROM tag_bindings
     WHERE workspace_id = $1
       AND creative_version_id = $2`,
    [workspaceId, creativeVersionId],
  );
  return rows.map((row) => row.tag_id).filter(Boolean);
}

import {
  randomUUID,
  enqueueVideoTranscodeJob,
  trimText,
  normalizeLimit,
  normalizeOffset,
  normalizeSearch,
  extractJsonObject,
  normalizeRawClickUrl,
  hasPublishedRenditionAsset,
  latestVersionSelect,
  normalizeCreativeStatus,
  normalizeBindingStatus,
  normalizeSourceKind,
  inferCreativeType,
  inferServingFormat,
  inferArtifactKind,
  normalizeHtmlEntryPath,
  resolvePublishedHtml5PreviewUrl,
  buildAutoVideoOutputPlan,
  getVideoProfileOutputKey,
  buildQueuedVideoProcessingMetadata,
  normalizeVariantStatus,
  normalizeRenditionStatus,
  normalizePositiveInteger,
  buildVariantLabel,
  estimateBitrateKbps,
  buildVideoLadderProfiles,
  buildVideoTargetProfiles,
} from './shared.mjs';

export async function listTagBindings(pool, workspaceId, tagId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.workspace_id, b.tag_id, b.creative_version_id, b.creative_size_variant_id,
            b.status, b.weight, b.start_at, b.end_at, b.created_at, b.updated_at,
            cv.creative_id, cv.status AS creative_version_status, cv.source_kind, cv.serving_format,
            cv.public_url, cv.entry_path,
            c.name AS creative_name,
            c.click_url AS creative_click_url,
            v.label AS variant_label,
            v.width AS variant_width,
            v.height AS variant_height,
            v.status AS variant_status
     FROM creative_tag_bindings b
     JOIN creative_versions cv ON cv.id = b.creative_version_id
     JOIN creatives c ON c.id = cv.creative_id
     LEFT JOIN creative_size_variants v ON v.id = b.creative_size_variant_id
     WHERE b.workspace_id = $1 AND b.tag_id = $2
     ORDER BY b.created_at DESC`,
    [workspaceId, tagId],
  );
  return rows;
}

export async function createTagBinding(pool, input = {}) {
  const {
    workspaceId,
    tagId,
    creativeVersionId,
    creativeSizeVariantId = null,
    status = 'active',
    weight = 1,
    startAt = null,
    endAt = null,
    createdBy = null,
  } = input;

  const existingResult = await pool.query(
    `SELECT id FROM creative_tag_bindings
     WHERE workspace_id = $1
       AND tag_id = $2
       AND creative_version_id = $3
       AND COALESCE(creative_size_variant_id, '') = COALESCE($4, '')`,
    [workspaceId, tagId, creativeVersionId, creativeSizeVariantId],
  );

  if (existingResult.rows[0]?.id) {
    return updateTagBinding(pool, workspaceId, tagId, existingResult.rows[0].id, {
      status,
      weight,
      start_at: startAt,
      end_at: endAt,
    });
  }

  await pool.query(
    `INSERT INTO creative_tag_bindings (
       workspace_id, tag_id, creative_version_id, creative_size_variant_id,
       status, weight, start_at, end_at, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      workspaceId,
      tagId,
      creativeVersionId,
      creativeSizeVariantId,
      normalizeBindingStatus(status),
      Math.max(1, Number(weight) || 1),
      startAt,
      endAt,
      createdBy,
    ],
  );

  const bindings = await listTagBindings(pool, workspaceId, tagId);
  return bindings[0] ?? null;
}

export async function updateTagBinding(pool, workspaceId, tagId, bindingId, input = {}) {
  const fields = [];
  const params = [workspaceId, tagId, bindingId];

  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    params.push(normalizeBindingStatus(input.status));
    fields.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'weight')) {
    params.push(Math.max(1, Number(input.weight) || 1));
    fields.push(`weight = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'start_at')) {
    params.push(input.start_at || null);
    fields.push(`start_at = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'end_at')) {
    params.push(input.end_at || null);
    fields.push(`end_at = $${params.length}`);
  }

  if (!fields.length) {
    const bindings = await listTagBindings(pool, workspaceId, tagId);
    return bindings.find((binding) => binding.id === bindingId) ?? null;
  }

  fields.push('updated_at = NOW()');
  await pool.query(
    `UPDATE creative_tag_bindings
     SET ${fields.join(', ')}
     WHERE workspace_id = $1 AND tag_id = $2 AND id = $3`,
    params,
  );

  const bindings = await listTagBindings(pool, workspaceId, tagId);
  return bindings.find((binding) => binding.id === bindingId) ?? null;
}

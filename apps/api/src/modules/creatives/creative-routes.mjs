import {
  createTagBinding,
  listCreatives,
  listCreativeVersions,
  getCreative,
  getCreativeVersion,
  createCreative,
  updateCreative,
  deleteCreative,
  assignCreativeToTag,
  removeCreativeFromTag,
} from '@smx/db';
import { getTag } from '@smx/db/tags';

function toApiCreativeVersion(version) {
  if (!version) return null;
  return {
    id: version.id,
    workspaceId: version.workspace_id,
    creativeId: version.creative_id,
    versionNumber: version.version_number,
    sourceKind: version.source_kind,
    servingFormat: version.serving_format,
    status: version.status,
    publicUrl: version.public_url ?? '',
    entryPath: version.entry_path ?? '',
    mimeType: version.mime_type ?? '',
    width: version.width ?? null,
    height: version.height ?? null,
    durationMs: version.duration_ms ?? null,
    fileSize: version.file_size ?? null,
    metadata: version.metadata ?? {},
    createdBy: version.created_by ?? null,
    reviewedBy: version.reviewed_by ?? null,
    reviewedAt: version.reviewed_at ?? null,
    reviewNotes: version.review_notes ?? '',
    createdAt: version.created_at,
    updatedAt: version.updated_at,
  };
}

export function handleCreativeRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/creatives
  app.get('/v1/creatives', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { status, tagId, format, limit, offset, search } = req.query;

    const creatives = await listCreatives(pool, workspaceId, {
      approval_status: status,
      type: format,
      limit,
      offset,
      search,
    });

    // If tagId filter requested, additionally filter by tag assignment
    if (tagId) {
      const { rows: tagCreativeIds } = await pool.query(
        `SELECT creative_id FROM tag_creatives WHERE tag_id = $1`,
        [tagId],
      );
      const idSet = new Set(tagCreativeIds.map(r => r.creative_id));
      return reply.send({ creatives: creatives.filter(c => idSet.has(c.id)) });
    }

    return reply.send({ creatives });
  });

  // POST /v1/creatives
  app.post('/v1/creatives', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const {
      name, format, vastUrl, videoUrl, duration, width, height, clickUrl,
      fileUrl, fileSize, mimeType, metadata,
    } = req.body ?? {};

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const VALID_FORMATS = ['vast_video', 'display', 'native', 'image', 'video', 'vast'];
    const type = format ?? 'display';
    if (!VALID_FORMATS.includes(type)) {
      return reply.status(400).send({ error: 'Bad Request', message: `format must be one of: ${VALID_FORMATS.join(', ')}` });
    }

    const creative = await createCreative(pool, workspaceId, {
      name,
      type,
      file_url: fileUrl ?? vastUrl ?? videoUrl ?? null,
      file_size: fileSize ?? null,
      mime_type: mimeType ?? null,
      width: width ?? null,
      height: height ?? null,
      duration_ms: duration ? duration * 1000 : null,
      click_url: clickUrl ?? null,
      metadata: metadata ?? {},
    });

    return reply.status(201).send({ creative });
  });

  // GET /v1/creatives/:id
  app.get('/v1/creatives/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }
    return reply.send({ creative });
  });

  // GET /v1/creatives/:id/versions
  app.get('/v1/creatives/:id/versions', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }

    const versions = await listCreativeVersions(pool, workspaceId, id);
    return reply.send({ versions: versions.map(toApiCreativeVersion) });
  });

  // GET /v1/creative-versions/:id
  app.get('/v1/creative-versions/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    return reply.send({ creativeVersion: toApiCreativeVersion(version) });
  });

  // PUT /v1/creatives/:id
  app.put('/v1/creatives/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const body = req.body ?? {};

    const fieldMap = {
      name: 'name',
      format: 'type',
      fileUrl: 'file_url',
      fileSize: 'file_size',
      mimeType: 'mime_type',
      width: 'width',
      height: 'height',
      clickUrl: 'click_url',
      metadata: 'metadata',
      transcodeStatus: 'transcode_status',
    };

    const data = {};
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (camel in body) data[snake] = body[camel];
    }

    if ('duration' in body) data.duration_ms = body.duration ? body.duration * 1000 : null;

    const creative = await updateCreative(pool, workspaceId, id, data);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }
    return reply.send({ creative });
  });

  // DELETE /v1/creatives/:id
  app.delete('/v1/creatives/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;

    const deleted = await deleteCreative(pool, workspaceId, id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }
    return reply.status(204).send();
  });

  // POST /v1/creatives/:id/assign/:tagId
  app.post('/v1/creatives/:id/assign/:tagId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id, tagId } = req.params;
    const { weight = 1 } = req.body ?? {};

    // Verify creative belongs to workspace
    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }

    // Verify tag belongs to workspace
    const { rows: tagRows } = await pool.query(
      `SELECT id FROM ad_tags WHERE id = $1 AND workspace_id = $2`,
      [tagId, workspaceId],
    );
    if (!tagRows.length) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const assignment = await assignCreativeToTag(pool, tagId, id, weight);
    return reply.status(201).send({ assignment });
  });

  // POST /v1/creative-versions/:id/assign/:tagId
  app.post('/v1/creative-versions/:id/assign/:tagId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId } = req.authSession;
    const { id, tagId } = req.params;
    const { weight = 1, status = 'active', startAt = null, endAt = null } = req.body ?? {};

    const version = await getCreativeVersion(pool, workspaceId, id);
    if (!version) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative version not found' });
    }

    const tag = await getTag(pool, workspaceId, tagId);
    if (!tag) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }

    const binding = await createTagBinding(pool, workspaceId, {
      tag_id: tagId,
      creative_version_id: id,
      status,
      weight,
      start_at: startAt,
      end_at: endAt,
      created_by: userId,
    });

    return reply.status(201).send({ binding });
  });

  // DELETE /v1/creatives/:id/assign/:tagId
  app.delete('/v1/creatives/:id/assign/:tagId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id, tagId } = req.params;

    // Verify creative belongs to workspace
    const creative = await getCreative(pool, workspaceId, id);
    if (!creative) {
      return reply.status(404).send({ error: 'Not Found', message: 'Creative not found' });
    }

    const removed = await removeCreativeFromTag(pool, tagId, id);
    if (!removed) {
      return reply.status(404).send({ error: 'Not Found', message: 'Assignment not found' });
    }
    return reply.status(204).send();
  });
}

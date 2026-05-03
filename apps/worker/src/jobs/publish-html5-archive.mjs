import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import unzipper from 'unzipper';
import { getPool } from '@smx/db/src/pool.mjs';
import {
  getCreativeIngestion,
  getCreativeVersion,
  updateCreativeIngestion,
  updateCreativeVersion,
} from '@smx/db/src/creatives.mjs';

function log(level, payload) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), service: 'smx-worker', job: 'publish-html5-archive', ...payload });
  level === 'error' ? console.error(line) : console.log(line);
}

const logInfo = (payload) => log('info', payload);
const logWarn = (payload) => log('warn', payload);

function trimText(value) {
  return String(value ?? '').trim();
}

function getConnectionString(source = process.env) {
  return String(source.DATABASE_POOL_URL || source.DATABASE_URL || '').trim();
}

function getAssetsPublicBaseUrl(source = process.env) {
  return trimText(source.ASSETS_PUBLIC_BASE_URL || source.R2_PUBLIC_BASE).replace(/\/+$/, '');
}

function isR2Configured(source = process.env) {
  return Boolean(
    source.R2_ENDPOINT
    && source.R2_BUCKET
    && source.R2_ACCESS_KEY_ID
    && source.R2_SECRET_ACCESS_KEY
    && getAssetsPublicBaseUrl(source),
  );
}

let cachedR2Client = null;
let cachedR2Key = '';

function getR2Client(source = process.env) {
  const cacheKey = `${source.R2_ENDPOINT}|${source.R2_ACCESS_KEY_ID}|${source.R2_BUCKET}`;
  if (cachedR2Client && cachedR2Key === cacheKey) return cachedR2Client;
  cachedR2Client = new S3Client({
    region: 'auto',
    endpoint: source.R2_ENDPOINT,
    credentials: {
      accessKeyId: source.R2_ACCESS_KEY_ID,
      secretAccessKey: source.R2_SECRET_ACCESS_KEY,
    },
  });
  cachedR2Key = cacheKey;
  return cachedR2Client;
}

function toPublicUrl(source, storageKey) {
  const base = getAssetsPublicBaseUrl(source);
  return base ? `${base}/${String(storageKey || '').replace(/^\/+/, '')}` : null;
}

export function normalizeArchiveMemberPath(rawPath) {
  const trimmed = trimText(rawPath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) return null;
  const normalized = path.posix.normalize(trimmed);
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) return null;
  if (normalized.startsWith('__MACOSX/') || normalized.endsWith('/.DS_Store') || normalized === '.DS_Store') return null;
  return normalized;
}

export function stripCommonArchiveRoot(paths) {
  const normalizedPaths = paths.map((value) => normalizeArchiveMemberPath(value)).filter(Boolean);
  if (!normalizedPaths.length) return [];
  const firstSegments = normalizedPaths.map((value) => value.split('/')[0]).filter(Boolean);
  const commonRoot = firstSegments.every((segment) => segment === firstSegments[0]) ? firstSegments[0] : '';
  if (!commonRoot) return normalizedPaths;
  const allNested = normalizedPaths.every((value) => value.startsWith(`${commonRoot}/`));
  if (!allNested) return normalizedPaths;
  return normalizedPaths.map((value) => value.slice(commonRoot.length + 1)).filter(Boolean);
}

function normalizeHtmlEntryPath(value) {
  const normalized = trimText(value).replace(/^\/+/, '');
  if (!normalized || normalized.toLowerCase().endsWith('.zip')) return 'index.html';
  return normalized;
}

function guessContentType(filename) {
  const ext = path.extname(String(filename || '').toLowerCase());
  switch (ext) {
    case '.html':
    case '.htm': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.mjs': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.avif': return 'image/avif';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.ttf': return 'font/ttf';
    case '.otf': return 'font/otf';
    case '.txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function buildPublishedStoragePrefix(workspaceId, creativeVersionId) {
  return `workspaces/${workspaceId}/creative-versions/${creativeVersionId}/html5`;
}

function mergePublishJob(metadata, patch) {
  const current = metadata && typeof metadata === 'object' ? metadata : {};
  return {
    ...current,
    publishJob: {
      ...(current.publishJob && typeof current.publishJob === 'object' ? current.publishJob : {}),
      updatedAt: new Date().toISOString(),
      ...patch,
    },
  };
}

async function uploadBufferToR2(source, { storageKey, body, contentType, cacheControl = 'public, max-age=300' }) {
  const client = getR2Client(source);
  await client.send(new PutObjectCommand({
    Bucket: source.R2_BUCKET,
    Key: storageKey,
    Body: body,
    ContentType: contentType,
    ContentLength: body.length,
    CacheControl: cacheControl,
  }));
  return {
    storageKey,
    publicUrl: toPublicUrl(source, storageKey),
    sizeBytes: body.length,
  };
}

async function loadArchiveEntries(buffer) {
  const directory = await unzipper.Open.buffer(buffer);
  const entries = [];
  for (const entry of directory.files || []) {
    if (entry.type !== 'File') continue;
    const archivePath = normalizeArchiveMemberPath(entry.path);
    if (!archivePath) continue;
    const body = await entry.buffer();
    entries.push({
      archivePath,
      body,
      sizeBytes: body.length,
    });
  }
  return entries;
}

function applyPublishedPaths(entries) {
  const strippedPaths = stripCommonArchiveRoot(entries.map((entry) => entry.archivePath));
  if (strippedPaths.length !== entries.length) {
    throw new Error('Archive path normalization failed.');
  }
  const seen = new Set();
  return entries.map((entry, index) => {
    const publishedPath = normalizeArchiveMemberPath(strippedPaths[index]);
    if (!publishedPath) {
      throw new Error(`Invalid published asset path for ${entry.archivePath}.`);
    }
    const key = publishedPath.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Archive contains duplicate asset path: ${publishedPath}`);
    }
    seen.add(key);
    return {
      ...entry,
      publishedPath,
    };
  });
}

function resolveEntryAsset(entries, desiredEntryPath) {
  const expected = normalizeArchiveMemberPath(desiredEntryPath) || 'index.html';
  const exactMatch = entries.find((entry) => entry.publishedPath === expected);
  if (exactMatch) return exactMatch;
  const ciMatch = entries.find((entry) => entry.publishedPath.toLowerCase() === expected.toLowerCase());
  if (ciMatch) return ciMatch;
  if (expected.toLowerCase() === 'index.html') {
    const fallback = entries
      .filter((entry) => path.posix.basename(entry.publishedPath).toLowerCase() === 'index.html')
      .sort((left, right) => left.publishedPath.length - right.publishedPath.length)[0];
    if (fallback) return fallback;
  }
  return null;
}

function buildDefaultDeps(source = process.env) {
  return {
    getPool: () => getPool(getConnectionString(source)),
    getCreativeIngestion,
    getCreativeVersion,
    updateCreativeIngestion,
    updateCreativeVersion,
    fetchImpl: fetch,
    loadArchiveEntries,
    uploadBufferToR2: (options) => uploadBufferToR2(source, options),
    logInfo,
    logWarn,
  };
}

export async function runPublishHtml5ArchiveJobWithDeps(ingestionId, source = process.env, deps = buildDefaultDeps(source)) {
  if (!trimText(ingestionId)) {
    deps.logWarn({ event: 'skipped', reason: 'missing_ingestion_id' });
    return { processed: 0, skipped: true, reason: 'missing_ingestion_id' };
  }

  const connectionString = getConnectionString(source);
  if (!connectionString) {
    deps.logWarn({ event: 'skipped', reason: 'database_not_configured', ingestionId });
    return { processed: 0, skipped: true, reason: 'database_not_configured' };
  }
  if (!isR2Configured(source)) {
    deps.logWarn({ event: 'skipped', reason: 'r2_not_configured', ingestionId });
    return { processed: 0, skipped: true, reason: 'r2_not_configured' };
  }

  const pool = deps.getPool();
  const { rows } = await pool.query(
    `SELECT id, workspace_id, creative_id, creative_version_id, source_kind, status,
            original_filename, mime_type, size_bytes, storage_key, public_url,
            checksum, metadata, validation_report, error_code, error_detail,
            created_at, updated_at
     FROM creative_ingestions
     WHERE id = $1
     LIMIT 1`,
    [ingestionId],
  );
  const ingestion = rows[0] ?? null;
  if (!ingestion) {
    deps.logWarn({ event: 'skipped', reason: 'ingestion_not_found', ingestionId });
    return { processed: 0, skipped: true, reason: 'ingestion_not_found' };
  }
  if (trimText(ingestion.source_kind).toLowerCase() !== 'html5_zip') {
    deps.logWarn({ event: 'skipped', reason: 'unsupported_source_kind', ingestionId, sourceKind: ingestion.source_kind });
    return { processed: 0, skipped: true, reason: 'unsupported_source_kind' };
  }
  if (!ingestion.creative_version_id) {
    throw new Error(`Creative ingestion ${ingestionId} is missing creative_version_id.`);
  }

  const workspaceId = ingestion.workspace_id;
  const creativeVersion = await deps.getCreativeVersion(pool, workspaceId, ingestion.creative_version_id);
  if (!creativeVersion) {
    throw new Error(`Creative version ${ingestion.creative_version_id} not found for ingestion ${ingestionId}.`);
  }

  const initialMetadata = ingestion.metadata && typeof ingestion.metadata === 'object' ? ingestion.metadata : {};
  await deps.updateCreativeIngestion(pool, workspaceId, ingestionId, {
    status: 'processing',
    metadata: mergePublishJob(initialMetadata, {
      stage: 'starting',
      progressPercent: 5,
      message: 'Preparing background publish job…',
    }),
    error_code: null,
    error_detail: null,
  });

  try {
    const sourceUrl = trimText(ingestion.public_url);
    if (!sourceUrl) {
      throw new Error(`Creative ingestion ${ingestionId} has no source ZIP URL.`);
    }

    const response = await deps.fetchImpl(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download source ZIP (${response.status} ${response.statusText}).`);
    }
    const archiveBuffer = Buffer.from(await response.arrayBuffer());
    await deps.updateCreativeIngestion(pool, workspaceId, ingestionId, {
      metadata: mergePublishJob(initialMetadata, {
        stage: 'publishing_html5_archive',
        progressPercent: 20,
        message: 'Publishing HTML5 assets…',
      }),
    });

    const rawEntries = await deps.loadArchiveEntries(archiveBuffer);
    const entries = applyPublishedPaths(rawEntries);
    if (!entries.length) {
      throw new Error('HTML5 archive contains no publishable files.');
    }

    const entryAsset = resolveEntryAsset(entries, creativeVersion.entry_path || initialMetadata.entryPath || 'index.html');
    if (!entryAsset) {
      throw new Error(`HTML5 archive is missing ${creativeVersion.entry_path || 'index.html'}.`);
    }

    const storagePrefix = buildPublishedStoragePrefix(workspaceId, creativeVersion.id);
    const uploaded = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const result = await deps.uploadBufferToR2({
        storageKey: `${storagePrefix}/${entry.publishedPath}`,
        body: entry.body,
        contentType: guessContentType(entry.publishedPath),
        cacheControl: entry.publishedPath.toLowerCase().endsWith('.html')
          ? 'no-store, no-cache, must-revalidate'
          : 'public, max-age=300',
      });
      uploaded.push({
        ...entry,
        ...result,
        mimeType: guessContentType(entry.publishedPath),
      });
      await deps.updateCreativeIngestion(pool, workspaceId, ingestionId, {
        metadata: mergePublishJob(initialMetadata, {
          stage: 'publishing_html5_archive',
          progressPercent: Math.min(85, 20 + Math.round(((index + 1) / entries.length) * 60)),
          message: 'Publishing HTML5 assets…',
        }),
      });
    }

    const publishedEntry = uploaded.find((entry) => entry.publishedPath === entryAsset.publishedPath) || uploaded[0];
    const publishMetadata = {
      ...(creativeVersion.metadata || {}),
      html5Publish: {
        status: 'completed',
        publishedAt: new Date().toISOString(),
        assetCount: uploaded.length,
        storagePrefix,
        entryPath: publishedEntry.publishedPath,
        publicUrl: publishedEntry.publicUrl,
      },
    };

    await deps.updateCreativeVersion(pool, workspaceId, creativeVersion.id, {
      status: 'draft',
      metadata: publishMetadata,
    });

    await pool.query(
      `UPDATE creative_versions
       SET public_url = $3,
           entry_path = $4,
           mime_type = COALESCE($5, mime_type),
           file_size = COALESCE($6, file_size),
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [
        workspaceId,
        creativeVersion.id,
        publishedEntry.publicUrl,
        publishedEntry.publishedPath,
        publishedEntry.mimeType,
        creativeVersion.file_size ?? ingestion.size_bytes ?? null,
      ],
    );

    await pool.query(
      `UPDATE creatives
       SET file_url = $3,
           thumbnail_url = $3,
           updated_at = NOW()
       WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, creativeVersion.creative_id, publishedEntry.publicUrl],
    );

    const artifactUpdate = await pool.query(
      `UPDATE creative_artifacts
       SET storage_key = $4,
           public_url = $5,
           mime_type = $6,
           size_bytes = $7,
           metadata = $8::jsonb,
           updated_at = NOW()
       WHERE workspace_id = $1
         AND creative_version_id = $2
         AND kind = 'published_html'
       RETURNING id`,
      [
        workspaceId,
        creativeVersion.id,
        'published_html',
        publishedEntry.storageKey,
        publishedEntry.publicUrl,
        publishedEntry.mimeType,
        publishedEntry.sizeBytes,
        JSON.stringify({
          ingestionId,
          assetCount: uploaded.length,
          entryPath: publishedEntry.publishedPath,
          storagePrefix,
        }),
      ],
    );

    if (!artifactUpdate.rowCount) {
      await pool.query(
        `INSERT INTO creative_artifacts (
           workspace_id, creative_version_id, kind, storage_key, public_url, mime_type,
           size_bytes, checksum, metadata
         )
         VALUES ($1, $2, 'published_html', $3, $4, $5, $6, NULL, $7::jsonb)`,
        [
          workspaceId,
          creativeVersion.id,
          publishedEntry.storageKey,
          publishedEntry.publicUrl,
          publishedEntry.mimeType,
          publishedEntry.sizeBytes,
          JSON.stringify({
            ingestionId,
            assetCount: uploaded.length,
            entryPath: publishedEntry.publishedPath,
            storagePrefix,
          }),
        ],
      );
    }

    const completedMetadata = mergePublishJob(initialMetadata, {
      stage: 'completed',
      progressPercent: 100,
      message: 'Publish completed.',
      publicUrl: publishedEntry.publicUrl,
      assetCount: uploaded.length,
      entryPath: publishedEntry.publishedPath,
      storagePrefix,
    });

    await deps.updateCreativeIngestion(pool, workspaceId, ingestionId, {
      status: 'published',
      public_url: ingestion.public_url,
      metadata: completedMetadata,
      validation_report: {
        ...(ingestion.validation_report || {}),
        readyToPublish: true,
        published: true,
        publishedPublicUrl: publishedEntry.publicUrl,
      },
      error_code: null,
      error_detail: null,
    });

    return {
      processed: 1,
      skipped: false,
      ingestionId,
      creativeVersionId: creativeVersion.id,
      assetCount: uploaded.length,
      publicUrl: publishedEntry.publicUrl,
    };
  } catch (error) {
    const failedMetadata = mergePublishJob(initialMetadata, {
      stage: 'failed',
      progressPercent: 0,
      message: error?.message || 'HTML5 publish failed.',
      errorCode: 'html5_publish_failed',
    });
    await deps.updateCreativeIngestion(pool, workspaceId, ingestionId, {
      status: 'failed',
      metadata: failedMetadata,
      error_code: 'html5_publish_failed',
      error_detail: error?.message || 'HTML5 publish failed.',
    });
    await deps.updateCreativeVersion(pool, workspaceId, creativeVersion.id, {
      status: 'draft',
      metadata: {
        ...(creativeVersion.metadata || {}),
        html5Publish: {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error?.message || 'HTML5 publish failed.',
        },
      },
    });
    throw error;
  }
}

export async function runPublishHtml5ArchiveJob(ingestionId, source = process.env) {
  return runPublishHtml5ArchiveJobWithDeps(ingestionId, source);
}

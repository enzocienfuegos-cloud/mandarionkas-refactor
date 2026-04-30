import { readFile, rm, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getPool } from '../../../../packages/db/src/pool.mjs';
import {
  claimNextAssetProcessingJob,
  completeAssetProcessingJob,
  failAssetProcessingJob,
  patchAssetMetadata,
  skipAssetProcessingJob,
} from '../../../../packages/db/src/asset-jobs.mjs';
import { logInfo, logWarn } from '../../../api/src/lib/logger.mjs';

function getConnectionString(source = process.env) {
  return String(source.DATABASE_POOL_URL || source.DATABASE_URL || '').trim();
}

function imageDerivativesEnabled(source = process.env) {
  return String(source.GENERATE_IMAGE_DERIVATIVES_ENABLED || '').trim().toLowerCase() === 'true';
}

function isR2Configured(source = process.env) {
  return Boolean(source.R2_ENDPOINT && source.R2_BUCKET && source.R2_ACCESS_KEY_ID && source.R2_SECRET_ACCESS_KEY);
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

async function uploadFileToR2(source, { storageKey, filePath, contentType }) {
  const client = getR2Client(source);
  const body = await readFile(filePath);
  await client.send(new PutObjectCommand({
    Bucket: source.R2_BUCKET,
    Key: storageKey,
    Body: body,
    ContentType: contentType,
  }));
}

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function normalizeOutputMetadata({ publicUrl, fileStats, mimeType, width, height }) {
  return {
    src: publicUrl,
    mimeType,
    sizeBytes: Number(fileStats.size),
    width: width || undefined,
    height: height || undefined,
  };
}

function isFinalAttempt(job) {
  const attempts = Number(job?.attempts || 0);
  const maxAttempts = Number(job?.max_attempts || 1);
  return attempts >= maxAttempts;
}

function computeRetryDelaySeconds(job) {
  const attempts = Number(job?.attempts || 1);
  return Math.min(300, Math.max(15, 15 * 2 ** Math.max(0, attempts - 1)));
}

function buildSharpOptions(mimeType, width) {
  if (mimeType === 'image/png') {
    return {
      outputMimeType: 'image/png',
      ext: 'png',
      encode: (pipeline) => pipeline.png({ compressionLevel: 9, palette: width <= 640 }),
    };
  }
  if (mimeType === 'image/webp') {
    return {
      outputMimeType: 'image/webp',
      ext: 'webp',
      encode: (pipeline) => pipeline.webp({ quality: width <= 640 ? 78 : width <= 1280 ? 84 : 90 }),
    };
  }
  return {
    outputMimeType: 'image/jpeg',
    ext: 'jpg',
    encode: (pipeline) => pipeline.jpeg({ mozjpeg: true, quality: width <= 640 ? 78 : width <= 1280 ? 84 : 90 }),
  };
}

function createDefaultDeps(source = process.env) {
  return {
    getPool,
    claimNextAssetProcessingJob,
    completeAssetProcessingJob,
    failAssetProcessingJob,
    patchAssetMetadata,
    skipAssetProcessingJob,
    logInfo,
    logWarn,
    loadSharp,
    uploadFileToR2,
    fetchImpl: fetch,
    mkdtemp,
    rm,
    stat,
    readFile,
  };
}

export async function runGenerateImageDerivativesJobWithDeps(source = process.env, deps = createDefaultDeps(source)) {
  const connectionString = getConnectionString(source);
  if (!connectionString) {
    deps.logInfo({ service: 'smx-worker', job: 'image-derivatives', status: 'skipped', reason: 'database_not_configured' });
    return { processed: 0, skipped: true };
  }

  const pool = deps.getPool(connectionString);
  const client = await pool.connect();
  let job = null;
  try {
    job = await deps.claimNextAssetProcessingJob(client, { jobType: 'image-derivatives' });
    if (!job) {
      deps.logInfo({ service: 'smx-worker', job: 'image-derivatives', status: 'idle', reason: 'no_pending_jobs' });
      return { processed: 0, skipped: false };
    }

    const input = job.input || {};
    const outputPlan = input.outputPlan || {};

    await deps.patchAssetMetadata(client, {
      assetId: job.asset_id,
      workspaceId: job.workspace_id,
      metadataPatch: {
        optimization: {
          image: {
            status: 'processing',
            jobId: job.id,
            outputs: outputPlan,
            retryCount: Number(job.attempts || 1),
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });

    if (!imageDerivativesEnabled(source)) {
      await deps.skipAssetProcessingJob(client, {
        jobId: job.id,
        reason: 'Image derivative generation is disabled. Set GENERATE_IMAGE_DERIVATIVES_ENABLED=true to enable sharp processing.',
        output: { outputs: outputPlan, mode: 'planned-only' },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            image: {
              status: 'planned',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'derivatives_disabled',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      return { processed: 0, skipped: false };
    }

    const sharp = await deps.loadSharp();
    if (!sharp) {
      await deps.skipAssetProcessingJob(client, {
        jobId: job.id,
        reason: 'sharp is not available in the worker environment.',
        output: { outputs: outputPlan, mode: 'sharp-missing' },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            image: {
              status: 'blocked',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'sharp_missing',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      deps.logWarn({ service: 'smx-worker', job: 'image-derivatives', status: 'skipped', jobId: job.id, reason: 'sharp_missing' });
      return { processed: 0, skipped: false };
    }

    if (!isR2Configured(source)) {
      await deps.skipAssetProcessingJob(client, {
        jobId: job.id,
        reason: 'R2 upload is not configured for image derivatives.',
        output: { outputs: outputPlan, mode: 'r2-missing' },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            image: {
              status: 'blocked',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'r2_missing',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      return { processed: 0, skipped: false };
    }

    const sourceUrl = String(input.publicUrl || '').trim();
    if (!sourceUrl) {
      await deps.failAssetProcessingJob(client, {
        jobId: job.id,
        errorMessage: 'Image derivative job is missing a source public URL.',
        final: true,
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            image: {
              status: 'failed',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'missing_source_url',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      return { processed: 0, skipped: false };
    }

    const response = await deps.fetchImpl(sourceUrl);
    if (!response.ok) {
      throw new Error(`Could not download image source: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = String(input.mimeType || '').trim().toLowerCase() || 'image/jpeg';
    const sourceMetadata = await sharp(buffer).metadata();
    const scratchDir = await deps.mkdtemp(path.join(tmpdir(), 'smx-image-job-'));

    try {
      const targets = [
        ['low', outputPlan.low],
        ['mid', outputPlan.mid],
        ['high', outputPlan.high],
        ['thumbnail', outputPlan.thumbnail],
      ].filter((entry) => entry[1]);

      const derivatives = {};
      for (const [key, plan] of targets) {
        const maxWidth = Number(plan.maxWidth || 0) || (key === 'thumbnail' ? 320 : 1280);
        const format = buildSharpOptions(mimeType, maxWidth);
        const outputPath = path.join(scratchDir, `${key}.${format.ext}`);
        let pipeline = sharp(buffer).rotate().resize({ width: maxWidth, withoutEnlargement: true });
        pipeline = format.encode(pipeline);
        await pipeline.toFile(outputPath);
        await deps.uploadFileToR2(source, { storageKey: plan.storageKey, filePath: outputPath, contentType: format.outputMimeType });
        const fileStats = await deps.stat(outputPath);
        const derivedMetadata = await sharp(await deps.readFile(outputPath)).metadata();
        derivatives[key] = normalizeOutputMetadata({
          publicUrl: plan.publicUrl,
          fileStats,
          mimeType: format.outputMimeType,
          width: derivedMetadata.width,
          height: derivedMetadata.height,
        });
      }

      await deps.completeAssetProcessingJob(client, {
        jobId: job.id,
        output: {
          outputs: outputPlan,
          mode: 'sharp-complete',
          derivatives,
        },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        thumbnailUrl: derivatives.thumbnail?.src ?? null,
        metadataPatch: {
          derivatives,
          optimizedUrl: derivatives.high?.src ?? derivatives.mid?.src ?? derivatives.low?.src ?? input.publicUrl,
          qualityPreference: 'auto',
          optimization: {
            image: {
              status: 'completed',
              jobId: job.id,
              outputs: outputPlan,
              width: sourceMetadata.width,
              height: sourceMetadata.height,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      return { processed: 1, skipped: false };
    } finally {
      await deps.rm(scratchDir, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch (error) {
    if (error?.message) {
      deps.logWarn({ service: 'smx-worker', job: 'image-derivatives', status: 'failed', reason: error.message });
    }
    if (!job) return { processed: 0, skipped: false };
    const final = isFinalAttempt(job);
    const retryDelaySeconds = final ? null : computeRetryDelaySeconds(job);
    const nextRetryAt = retryDelaySeconds ? new Date(Date.now() + retryDelaySeconds * 1000).toISOString() : null;
    await deps.failAssetProcessingJob(client, {
      jobId: job.id,
      errorMessage: error instanceof Error ? error.message : 'Image derivative generation failed.',
      output: {
        outputs: job.input?.outputPlan || {},
        mode: final ? 'sharp-failed-final' : 'sharp-failed-retry',
        attempts: Number(job.attempts || 1),
        maxAttempts: Number(job.max_attempts || 1),
      },
      final,
      retryDelaySeconds,
    });
    await deps.patchAssetMetadata(client, {
      assetId: job.asset_id,
      workspaceId: job.workspace_id,
      metadataPatch: {
        optimization: {
          image: {
            status: final ? 'failed' : 'queued',
            jobId: job.id,
            outputs: job.input?.outputPlan || {},
            reason: error instanceof Error ? error.message : 'image_processing_failed',
            retryCount: Number(job.attempts || 1),
            lastRetryAt: new Date().toISOString(),
            nextRetryAt,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    return { processed: 0, skipped: false };
  } finally {
    client.release();
  }
}

export async function runGenerateImageDerivativesJob(source = process.env) {
  return runGenerateImageDerivativesJobWithDeps(source, createDefaultDeps(source));
}

export const __testables = {
  buildSharpOptions,
  getConnectionString,
  imageDerivativesEnabled,
  isR2Configured,
  isFinalAttempt,
  computeRetryDelaySeconds,
  normalizeOutputMetadata,
};

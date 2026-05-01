import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getPool, closeAllPools } from '../../../../packages/db/src/pool.mjs';
import {
  claimNextAssetProcessingJob,
  completeAssetProcessingJob,
  failAssetProcessingJob,
  patchAssetMetadata,
  skipAssetProcessingJob,
} from '../../../../packages/db/src/asset-jobs.mjs';
import {
  syncCreativeVideoTranscodeOutputs,
  updateCreativeVersionVideoProcessingState,
} from '../../../../packages/db/src/creatives.mjs';
import { logError, logInfo, logWarn } from '../../../api/src/lib/logger.mjs';

const require = createRequire(import.meta.url);
let cachedBundledFfmpegBin;

function getBundledFfmpegBin() {
  if (cachedBundledFfmpegBin !== undefined) return cachedBundledFfmpegBin;
  try {
    const resolved = require('ffmpeg-static');
    cachedBundledFfmpegBin = resolved ? String(resolved).trim() : null;
  } catch {
    cachedBundledFfmpegBin = null;
  }
  return cachedBundledFfmpegBin;
}

function getConnectionString(source = process.env) {
  return String(source.DATABASE_POOL_URL || source.DATABASE_URL || '').trim();
}

function getConfiguredFfmpegBin(source = process.env) {
  return String(source.FFMPEG_BIN || '').trim();
}

function getFfmpegBin(source = process.env) {
  const configured = getConfiguredFfmpegBin(source);
  if (configured) return configured;
  const bundled = getBundledFfmpegBin();
  if (bundled) return bundled;
  return 'ffmpeg';
}

function transcodeEnabled(source = process.env) {
  const normalized = String(source.TRANSCODE_VIDEO_ENABLED || '').trim().toLowerCase();
  if (!normalized) return true;
  return !['false', '0', 'off', 'no', 'disabled'].includes(normalized);
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

function buildOutputPlan(input = {}) {
  const storageKey = String(input.storageKey || '').trim();
  const publicUrl = String(input.publicUrl || '').trim();
  const baseKey = storageKey.replace(/\.[^.]+$/, '');
  const baseUrl = publicUrl.replace(/\.[^.]+$/, '');
  return {
    low: {
      storageKey: `${baseKey}-low.mp4`,
      publicUrl: `${baseUrl}-low.mp4`,
      maxHeight: 480,
      videoBitrateKbps: 900,
    },
    mid: {
      storageKey: `${baseKey}-mid.mp4`,
      publicUrl: `${baseUrl}-mid.mp4`,
      maxHeight: 720,
      videoBitrateKbps: 1500,
    },
    high: {
      storageKey: `${baseKey}-high.mp4`,
      publicUrl: `${baseUrl}-high.mp4`,
      maxHeight: 1080,
      videoBitrateKbps: 2400,
    },
    poster: {
      storageKey: `${baseKey}-poster.jpg`,
      publicUrl: `${baseUrl}-poster.jpg`,
    },
  };
}

function getRequestedProfiles(input = {}, outputPlan = {}) {
  const targetPlan = Array.isArray(input.targetPlan) ? input.targetPlan : [];
  const normalized = targetPlan
    .map((profile) => {
      const label = String(profile?.label || '').trim();
      if (!label) return null;
      const key = label.toLowerCase() === '1080p' ? 'high'
        : label.toLowerCase() === '720p' ? 'mid'
        : label.toLowerCase() === '480p' ? 'low'
        : null;
      if (!key || !outputPlan[key]) return null;
      return {
        key,
        label,
        fileName: `${key}.mp4`,
        storageKey: outputPlan[key].storageKey,
        publicUrl: outputPlan[key].publicUrl,
        maxHeight: Number(profile?.height || outputPlan[key].maxHeight || 0) || outputPlan[key].maxHeight,
        videoBitrateKbps: Number(profile?.bitrateKbps || outputPlan[key].videoBitrateKbps || 0) || outputPlan[key].videoBitrateKbps,
        width: Number(profile?.width || 0) || undefined,
        height: Number(profile?.height || 0) || undefined,
      };
    })
    .filter(Boolean);

  if (normalized.length) return normalized;

  return [
    {
      key: 'low',
      label: '480p',
      fileName: 'low.mp4',
      storageKey: outputPlan.low.storageKey,
      publicUrl: outputPlan.low.publicUrl,
      maxHeight: outputPlan.low.maxHeight,
      videoBitrateKbps: outputPlan.low.videoBitrateKbps,
    },
    {
      key: 'mid',
      label: '720p',
      fileName: 'mid.mp4',
      storageKey: outputPlan.mid.storageKey,
      publicUrl: outputPlan.mid.publicUrl,
      maxHeight: outputPlan.mid.maxHeight,
      videoBitrateKbps: outputPlan.mid.videoBitrateKbps,
    },
    {
      key: 'high',
      label: '1080p',
      fileName: 'high.mp4',
      storageKey: outputPlan.high.storageKey,
      publicUrl: outputPlan.high.publicUrl,
      maxHeight: outputPlan.high.maxHeight,
      videoBitrateKbps: outputPlan.high.videoBitrateKbps,
    },
  ];
}

async function commandExists(binary) {
  return new Promise((resolve) => {
    const child = spawn(binary, ['-version'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function runFfmpeg(binary, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, stdio: 'pipe' });
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(
        [
          `ffmpeg exited with code ${code}`,
          stderr.trim(),
          stdout.trim(),
        ].filter(Boolean).join('\n\n'),
      ));
    });
  });
}

async function downloadSourceToFile(sourceUrl, targetPath) {
  const response = await fetch(sourceUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download source video: ${response.status} ${response.statusText}`.trim());
  }
  await pipeline(response.body, createWriteStream(targetPath));
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

function normalizeOutputMetadata({ publicUrl, fileStats, mimeType, codec, width, height, bitrateKbps }) {
  return {
    src: publicUrl,
    mimeType,
    sizeBytes: Number(fileStats.size),
    width: width || undefined,
    height: height || undefined,
    bitrateKbps: bitrateKbps || undefined,
    codec: codec || undefined,
  };
}

function isFinalAttempt(job) {
  const attempts = Number(job?.attempts || 0);
  const maxAttempts = Number(job?.max_attempts || 1);
  return attempts >= maxAttempts;
}

function computeRetryDelaySeconds(job) {
  const attempts = Number(job?.attempts || 1);
  return Math.min(600, Math.max(30, 30 * 2 ** Math.max(0, attempts - 1)));
}

function createDefaultDeps(source = process.env) {
  return {
    getPool,
    closeAllPools,
    claimNextAssetProcessingJob,
    completeAssetProcessingJob,
    failAssetProcessingJob,
    patchAssetMetadata,
    skipAssetProcessingJob,
    syncCreativeVideoTranscodeOutputs,
    updateCreativeVersionVideoProcessingState,
    logError,
    logInfo,
    logWarn,
    commandExists,
    runFfmpeg,
    uploadFileToR2,
    mkdtemp,
    rm,
    stat,
  };
}

export async function runTranscodeVideoJobWithDeps(source = process.env, deps = createDefaultDeps(source)) {
  const connectionString = getConnectionString(source);
  if (!connectionString) {
    deps.logInfo({ service: 'smx-worker', job: 'transcode-video', status: 'skipped', reason: 'database_not_configured' });
    return { processed: 0, skipped: true };
  }

  const pool = deps.getPool(connectionString);
  const client = await pool.connect();
  let job = null;
  try {
    job = await deps.claimNextAssetProcessingJob(client, { jobType: 'video-transcode' });
    if (!job) {
      deps.logInfo({ service: 'smx-worker', job: 'transcode-video', status: 'idle', reason: 'no_pending_jobs' });
      return { processed: 0, skipped: false };
    }

    const input = job.input || {};
    const outputPlan = buildOutputPlan(input);
    const requestedProfiles = getRequestedProfiles(input, outputPlan);
    const assetMetadataPatch = {
      optimization: {
        video: {
          status: 'processing',
          jobId: job.id,
          outputs: outputPlan,
          retryCount: Number(job.attempts || 1),
          updatedAt: new Date().toISOString(),
        },
      },
    };
    await deps.patchAssetMetadata(client, {
      assetId: job.asset_id,
      workspaceId: job.workspace_id,
      metadataPatch: assetMetadataPatch,
    });
    if (input.creativeVersionId) {
      await deps.updateCreativeVersionVideoProcessingState(client, {
        workspaceId: job.workspace_id,
        creativeVersionId: input.creativeVersionId,
        status: 'processing',
      });
    }

    if (!transcodeEnabled(source)) {
      await deps.skipAssetProcessingJob(client, {
        jobId: job.id,
        reason: 'Video transcoding is disabled. Set TRANSCODE_VIDEO_ENABLED=true to enable ffmpeg processing.',
        output: { outputs: outputPlan, mode: 'planned-only' },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            video: {
              status: 'planned',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'transcoding_disabled',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      if (input.creativeVersionId) {
        await deps.updateCreativeVersionVideoProcessingState(client, {
          workspaceId: job.workspace_id,
          creativeVersionId: input.creativeVersionId,
          status: 'blocked',
          reason: 'transcoding_disabled',
        });
      }
      deps.logWarn({ service: 'smx-worker', job: 'transcode-video', status: 'skipped', jobId: job.id, reason: 'transcoding_disabled' });
      return { processed: 0, skipped: false };
    }

    const configuredFfmpegBin = getConfiguredFfmpegBin(source);
    const bundledFfmpegBin = getBundledFfmpegBin();
    let ffmpegBin = getFfmpegBin(source);
    let ffmpegReady = await deps.commandExists(ffmpegBin);
    if (!ffmpegReady && configuredFfmpegBin && bundledFfmpegBin && bundledFfmpegBin !== configuredFfmpegBin) {
      const bundledReady = await deps.commandExists(bundledFfmpegBin);
      if (bundledReady) {
        ffmpegBin = bundledFfmpegBin;
        ffmpegReady = true;
      }
    }
    if (!ffmpegReady) {
      await deps.skipAssetProcessingJob(client, {
        jobId: job.id,
        reason: `ffmpeg binary "${ffmpegBin}" is not available in the worker environment.`,
        output: { outputs: outputPlan, mode: 'ffmpeg-missing' },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            video: {
              status: 'blocked',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'ffmpeg_missing',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      if (input.creativeVersionId) {
        await deps.updateCreativeVersionVideoProcessingState(client, {
          workspaceId: job.workspace_id,
          creativeVersionId: input.creativeVersionId,
          status: 'blocked',
          reason: 'ffmpeg_missing',
        });
      }
      deps.logWarn({ service: 'smx-worker', job: 'transcode-video', status: 'skipped', jobId: job.id, reason: 'ffmpeg_missing' });
      return { processed: 0, skipped: false };
    }
    if (!isR2Configured(source)) {
      await deps.skipAssetProcessingJob(client, {
        jobId: job.id,
        reason: 'R2 upload is not configured for worker transcoding.',
        output: { outputs: outputPlan, mode: 'r2-missing' },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            video: {
              status: 'blocked',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'r2_missing',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      if (input.creativeVersionId) {
        await deps.updateCreativeVersionVideoProcessingState(client, {
          workspaceId: job.workspace_id,
          creativeVersionId: input.creativeVersionId,
          status: 'blocked',
          reason: 'r2_missing',
        });
      }
      deps.logWarn({ service: 'smx-worker', job: 'transcode-video', status: 'skipped', jobId: job.id, reason: 'r2_missing' });
      return { processed: 0, skipped: false };
    }

    const sourceUrl = String(input.publicUrl || '').trim();
    if (!sourceUrl) {
      await deps.failAssetProcessingJob(client, {
        jobId: job.id,
        errorMessage: 'Video transcode job is missing a source public URL.',
        final: true,
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        metadataPatch: {
          optimization: {
            video: {
              status: 'failed',
              jobId: job.id,
              outputs: outputPlan,
              reason: 'missing_source_url',
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      if (input.creativeVersionId) {
        await deps.updateCreativeVersionVideoProcessingState(client, {
          workspaceId: job.workspace_id,
          creativeVersionId: input.creativeVersionId,
          status: 'failed',
          reason: 'missing_source_url',
        });
      }
      return { processed: 0, skipped: false };
    }

    const scratchDir = await deps.mkdtemp(path.join(tmpdir(), 'smx-video-job-'));
    try {
      const posterPath = path.join(scratchDir, 'poster.jpg');
      const sourcePath = path.join(scratchDir, 'source.mp4');

      await downloadSourceToFile(sourceUrl, sourcePath);

      const transcodedProfiles = [];
      for (const profile of requestedProfiles) {
        const filePath = path.join(scratchDir, profile.fileName);
        await deps.runFfmpeg(
          ffmpegBin,
          ['-y', '-i', sourcePath, '-vf', `scale=-2:${profile.maxHeight}`, '-c:v', 'libx264', '-b:v', `${profile.videoBitrateKbps}k`, '-an', filePath],
          scratchDir,
        );
        transcodedProfiles.push({ ...profile, filePath });
      }
      await deps.runFfmpeg(ffmpegBin, ['-y', '-i', sourcePath, '-frames:v', '1', posterPath], scratchDir);

      for (const profile of transcodedProfiles) {
        await deps.uploadFileToR2(source, { storageKey: profile.storageKey, filePath: profile.filePath, contentType: 'video/mp4' });
      }
      await deps.uploadFileToR2(source, { storageKey: outputPlan.poster.storageKey, filePath: posterPath, contentType: 'image/jpeg' });

      const derivatives = {};
      for (const profile of transcodedProfiles) {
        const fileStats = await deps.stat(profile.filePath);
        derivatives[profile.key] = normalizeOutputMetadata({
          publicUrl: profile.publicUrl,
          fileStats,
          mimeType: 'video/mp4',
          codec: 'h264',
          bitrateKbps: profile.videoBitrateKbps,
          width: profile.width,
          height: profile.height,
        });
      }
      const posterStats = await deps.stat(posterPath);
      derivatives.poster = normalizeOutputMetadata({
        publicUrl: outputPlan.poster.publicUrl,
        fileStats: posterStats,
        mimeType: 'image/jpeg',
      });

      await deps.completeAssetProcessingJob(client, {
        jobId: job.id,
        output: {
          outputs: outputPlan,
          mode: 'ffmpeg-complete',
          derivatives,
        },
      });
      await deps.patchAssetMetadata(client, {
        assetId: job.asset_id,
        workspaceId: job.workspace_id,
        posterSrc: outputPlan.poster.publicUrl,
        thumbnailUrl: outputPlan.poster.publicUrl,
        metadataPatch: {
          derivatives,
          optimizedUrl: outputPlan.high.publicUrl,
          qualityPreference: 'auto',
          optimization: {
            video: {
              status: 'completed',
              jobId: job.id,
              outputs: outputPlan,
              posterGenerated: true,
              uploaded: true,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
      if (input.creativeVersionId) {
        await deps.syncCreativeVideoTranscodeOutputs(client, {
          workspaceId: job.workspace_id,
          creativeVersionId: input.creativeVersionId,
          outputPlan,
          derivatives,
        });
      }
      deps.logInfo({ service: 'smx-worker', job: 'transcode-video', status: 'completed', jobId: job.id, assetId: job.asset_id });
      return { processed: 1, skipped: false };
    } finally {
      await deps.rm(scratchDir, { recursive: true, force: true });
    }
  } catch (error) {
    deps.logError({ service: 'smx-worker', job: 'transcode-video', status: 'failed', error });
    if (!job) throw error;
    const final = isFinalAttempt(job);
    const retryDelaySeconds = final ? null : computeRetryDelaySeconds(job);
    const nextRetryAt = retryDelaySeconds ? new Date(Date.now() + retryDelaySeconds * 1000).toISOString() : null;
    await deps.failAssetProcessingJob(client, {
      jobId: job.id,
      errorMessage: error instanceof Error ? error.message : 'Video transcoding failed.',
      output: {
        outputs: job.input?.outputPlan || buildOutputPlan(job.input || {}),
        mode: final ? 'ffmpeg-failed-final' : 'ffmpeg-failed-retry',
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
          video: {
            status: final ? 'failed' : 'queued',
            jobId: job.id,
            outputs: job.input?.outputPlan || buildOutputPlan(job.input || {}),
            reason: error instanceof Error ? error.message : 'video_processing_failed',
            retryCount: Number(job.attempts || 1),
            lastRetryAt: new Date().toISOString(),
            nextRetryAt,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    if (job.input?.creativeVersionId) {
      await deps.updateCreativeVersionVideoProcessingState(client, {
        workspaceId: job.workspace_id,
        creativeVersionId: job.input.creativeVersionId,
        status: final ? 'failed' : 'queued',
        reason: error instanceof Error ? error.message : 'video_processing_failed',
        nextRetryAt,
        retryCount: Number(job.attempts || 1),
      });
    }
    return { processed: 0, skipped: false };
  } finally {
    client.release();
    await deps.closeAllPools();
  }
}

export async function runTranscodeVideoJob(source = process.env) {
  return runTranscodeVideoJobWithDeps(source, createDefaultDeps(source));
}

export const __testables = {
  buildOutputPlan,
  getConnectionString,
  getFfmpegBin,
  transcodeEnabled,
  isR2Configured,
  isFinalAttempt,
  computeRetryDelaySeconds,
  normalizeOutputMetadata,
};

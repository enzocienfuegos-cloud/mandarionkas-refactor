import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getPool, closeAllPools } from '@smx/db/src/pool.mjs';
import {
  claimNextVideoTranscodeJob,
  completeVideoTranscodeJob,
  failVideoTranscodeJob,
  markVideoTranscodeJobProcessing,
} from '@smx/db/src/video-transcode-jobs.mjs';
import {
  syncCreativeVideoTranscodeOutputs,
} from '@smx/db/src/creatives.mjs';

function log(level, payload) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), service: 'smx-worker', job: 'transcode-video', ...payload });
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

const logInfo = (payload) => log('info', payload);
const logWarn = (payload) => log('warn', payload);
const logError = (payload) => log('error', payload);

const require = createRequire(import.meta.url);
let cachedFfmpeg;

function getBundledFfmpegBin() {
  if (cachedFfmpeg !== undefined) return cachedFfmpeg;
  try {
    const resolved = require('ffmpeg-static');
    cachedFfmpeg = resolved ? String(resolved).trim() : null;
  } catch {
    cachedFfmpeg = null;
  }
  return cachedFfmpeg;
}

function getFfmpegBin(source = process.env) {
  return String(source.FFMPEG_BIN || '').trim()
    || getBundledFfmpegBin()
    || 'ffmpeg';
}

function getConnectionString(source = process.env) {
  return String(source.DATABASE_POOL_URL || source.DATABASE_URL || '').trim();
}

function transcodeEnabled(source = process.env) {
  const value = String(source.TRANSCODE_VIDEO_ENABLED || '').trim().toLowerCase();
  return !value || !['false', '0', 'off', 'no', 'disabled'].includes(value);
}

function isR2Configured(source = process.env) {
  return Boolean(source.R2_ENDPOINT && source.R2_BUCKET && source.R2_ACCESS_KEY_ID && source.R2_SECRET_ACCESS_KEY);
}

let cachedR2Client = null;
let cachedR2Key = '';

function getR2Client(source = process.env) {
  const key = `${source.R2_ENDPOINT}|${source.R2_ACCESS_KEY_ID}|${source.R2_BUCKET}`;
  if (cachedR2Client && cachedR2Key === key) return cachedR2Client;
  cachedR2Client = new S3Client({
    region: 'auto',
    endpoint: source.R2_ENDPOINT,
    credentials: { accessKeyId: source.R2_ACCESS_KEY_ID, secretAccessKey: source.R2_SECRET_ACCESS_KEY },
  });
  cachedR2Key = key;
  return cachedR2Client;
}

const DEFAULT_PROFILES = [
  { label: '480p', key: 'low', maxHeight: 480, videoBitrateKbps: 900 },
  { label: '720p', key: 'mid', maxHeight: 720, videoBitrateKbps: 1500 },
  { label: '1080p', key: 'high', maxHeight: 1080, videoBitrateKbps: 2400 },
];

function buildOutputPlan(job) {
  const sourceUrl = job.source_url;
  const storageBase = (job.source_storage_key || '').replace(/\.[^.]+$/, '');
  const urlBase = sourceUrl.replace(/\.[^.]+$/, '');
  const publicBase = String(process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '');

  const targetPlan = Array.isArray(job.target_plan) ? job.target_plan : [];
  const profiles = targetPlan.length > 0
    ? targetPlan.map((profile) => ({
      label: String(profile.label || '').trim(),
      key: String(profile.label || '').trim().toLowerCase(),
      maxHeight: Number(profile.height || profile.maxHeight || 480),
      videoBitrateKbps: Number(profile.bitrateKbps || 900),
      width: Number(profile.width || 0) || undefined,
    }))
    : DEFAULT_PROFILES;

  return profiles.map((profile) => {
    const storageKey = storageBase ? `${storageBase}-${profile.key}.mp4` : '';
    const publicUrl = storageKey && publicBase
      ? `${publicBase}/${storageKey}`
      : `${urlBase}-${profile.key}.mp4`;
    return { ...profile, storageKey, publicUrl, fileName: `${profile.key}.mp4` };
  });
}

function buildPosterPlan(job) {
  const urlBase = job.source_url.replace(/\.[^.]+$/, '');
  const storageBase = (job.source_storage_key || '').replace(/\.[^.]+$/, '');
  const publicBase = String(process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
  const storageKey = storageBase ? `${storageBase}-poster.jpg` : '';
  const publicUrl = storageKey && publicBase
    ? `${publicBase}/${storageKey}`
    : `${urlBase}-poster.jpg`;
  return { storageKey, publicUrl };
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
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stderr });
        return;
      }
      reject(new Error(`ffmpeg exited ${code}\n${stderr.trim()}`));
    });
  });
}

async function downloadSource(url, destination) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  await pipeline(response.body, createWriteStream(destination));
}

async function uploadToR2(source, { storageKey, filePath, contentType }) {
  if (!storageKey) {
    logWarn({ event: 'upload_skipped', reason: 'no_storage_key', filePath });
    return null;
  }
  const client = getR2Client(source);
  const body = await readFile(filePath);
  await client.send(new PutObjectCommand({ Bucket: source.R2_BUCKET, Key: storageKey, Body: body, ContentType: contentType }));
  return storageKey;
}

export async function runTranscodeVideoJobWithDeps(source = process.env, deps = {}) {
  const {
    _getPool = () => getPool(getConnectionString(source)),
    _closeAllPools = closeAllPools,
    _claimJob = claimNextVideoTranscodeJob,
    _markProcessing = markVideoTranscodeJobProcessing,
    _completeJob = completeVideoTranscodeJob,
    _failJob = failVideoTranscodeJob,
    _syncOutputs = syncCreativeVideoTranscodeOutputs,
    _commandExists = commandExists,
    _runFfmpeg = runFfmpeg,
    _downloadSource = downloadSource,
    _uploadToR2 = (options) => uploadToR2(source, options),
    _mkdtemp = mkdtemp,
    _rm = rm,
    _stat = stat,
  } = deps;

  const connectionString = getConnectionString(source);
  if (!connectionString) {
    logInfo({ status: 'skipped', reason: 'database_not_configured' });
    return { processed: 0, skipped: true };
  }

  const pool = _getPool();
  const client = await pool.connect();
  let job = null;

  try {
    job = await _claimJob(client);
    if (!job) {
      logInfo({ status: 'idle', reason: 'no_pending_jobs' });
      return { processed: 0, skipped: false };
    }

    logInfo({ status: 'claimed', jobId: job.id, creativeVersionId: job.creative_version_id });

    if (!transcodeEnabled(source)) {
      await _failJob(client, job.id, 'TRANSCODE_VIDEO_ENABLED is not set to true.', { reason: 'transcoding_disabled' });
      logWarn({ status: 'failed', jobId: job.id, reason: 'transcoding_disabled' });
      return { processed: 0, skipped: false };
    }

    const ffmpegBin = getFfmpegBin(source);
    const ffmpegReady = await _commandExists(ffmpegBin);
    if (!ffmpegReady) {
      await _failJob(client, job.id, `ffmpeg binary "${ffmpegBin}" not available.`, { reason: 'ffmpeg_missing', binary: ffmpegBin });
      logWarn({ status: 'failed', jobId: job.id, reason: 'ffmpeg_missing' });
      return { processed: 0, skipped: false };
    }

    if (!isR2Configured(source)) {
      await _failJob(client, job.id, 'R2 storage is not configured.', { reason: 'r2_missing' });
      logWarn({ status: 'failed', jobId: job.id, reason: 'r2_missing' });
      return { processed: 0, skipped: false };
    }

    if (!job.source_url) {
      await _failJob(client, job.id, 'Job has no source_url.', { reason: 'missing_source_url' });
      logWarn({ status: 'failed', jobId: job.id, reason: 'missing_source_url' });
      return { processed: 0, skipped: false };
    }

    await _markProcessing(client, job.id);

    const outputProfiles = buildOutputPlan(job);
    const posterPlan = buildPosterPlan(job);
    const scratchDir = await _mkdtemp(path.join(tmpdir(), 'smx-video-'));

    try {
      const sourcePath = path.join(scratchDir, 'source.mp4');
      const posterPath = path.join(scratchDir, 'poster.jpg');

      logInfo({ event: 'download_start', jobId: job.id, sourceUrl: job.source_url });
      await _downloadSource(job.source_url, sourcePath);
      logInfo({ event: 'download_complete', jobId: job.id });

      const completedProfiles = [];
      for (const profile of outputProfiles) {
        const outPath = path.join(scratchDir, profile.fileName);
      const args = [
        '-y', '-i', sourcePath,
        '-vf', `scale=-2:${profile.maxHeight}`,
        '-c:v', 'libx264',
        '-b:v', `${profile.videoBitrateKbps}k`,
        '-preset', 'veryfast',
        '-threads', '1',
        '-movflags', '+faststart',
        '-an',
        outPath,
      ];
        logInfo({ event: 'transcode_start', jobId: job.id, profile: profile.label });
        await _runFfmpeg(ffmpegBin, args, scratchDir);
        completedProfiles.push({ ...profile, filePath: outPath });
        logInfo({ event: 'transcode_complete', jobId: job.id, profile: profile.label });
      }

      await _runFfmpeg(ffmpegBin, ['-y', '-i', sourcePath, '-frames:v', '1', posterPath], scratchDir);

      const renditionRows = [];
      for (const profile of completedProfiles) {
        const fileInfo = await _stat(profile.filePath);
        const uploaded = await _uploadToR2({ storageKey: profile.storageKey, filePath: profile.filePath, contentType: 'video/mp4' });
    renditionRows.push({
      label: profile.label,
      key: profile.key,
      publicUrl: profile.publicUrl,
      storageKey: uploaded || profile.storageKey,
      width: profile.width ?? null,
          height: profile.maxHeight,
          bitrateKbps: profile.videoBitrateKbps,
          codec: 'h264',
          mimeType: 'video/mp4',
          sizeBytes: fileInfo.size,
        });
      }

      const posterUploaded = await _uploadToR2({ storageKey: posterPlan.storageKey, filePath: posterPath, contentType: 'image/jpeg' });

      const output = {
        renditions: renditionRows,
        posterUrl: posterUploaded ? posterPlan.publicUrl : null,
        posterStorageKey: posterUploaded || null,
      };

      await _completeJob(client, job.id, output);

      await _syncOutputs(client, {
        workspaceId: job.workspace_id,
        creativeVersionId: job.creative_version_id,
        outputPlan: {
          ...Object.fromEntries(
            completedProfiles.map((profile) => [profile.key, {
              publicUrl: profile.publicUrl,
              storageKey: profile.storageKey,
            }]),
          ),
          poster: { publicUrl: output.posterUrl || '' },
        },
        derivatives: Object.fromEntries(
          renditionRows.map((row) => [row.key, {
            src: row.publicUrl,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            width: row.width,
            height: row.height,
            bitrateKbps: row.bitrateKbps,
            codec: row.codec,
          }]),
        ),
      });

      logInfo({ status: 'completed', jobId: job.id, creativeVersionId: job.creative_version_id, renditions: renditionRows.length });
      return { processed: 1, skipped: false };
    } finally {
      await _rm(scratchDir, { recursive: true, force: true });
    }
  } catch (error) {
    logError({ status: 'error', jobId: job?.id, error: error?.message, stack: error?.stack });

    if (job) {
      await _failJob(client, job.id, error?.message || 'Video transcoding failed.', {
        attempts: job.attempts,
        maxAttempts: job.max_attempts,
        final: job.attempts >= job.max_attempts,
      }).catch(() => undefined);
    }

    return { processed: 0, skipped: false };
  } finally {
    client.release();
    await _closeAllPools();
  }
}

export async function runTranscodeVideoJob(source = process.env) {
  return runTranscodeVideoJobWithDeps(source);
}

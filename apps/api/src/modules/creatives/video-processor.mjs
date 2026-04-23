import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { getObjectBuffer, putObjectBuffer } from '../storage/object-storage.mjs';

const execFile = promisify(execFileCallback);

async function runBinary(binary, args, options = {}) {
  try {
    const result = await execFile(binary, args, {
      timeout: options.timeoutMs ?? 15000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { ok: false, missing: true, stdout: '', stderr: '' };
    }
    return {
      ok: false,
      missing: false,
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? '',
      error,
    };
  }
}

async function probeVideoFile(videoPath) {
  const result = await runBinary('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    videoPath,
  ]);

  if (!result.ok) {
    return {
      available: false,
      metadata: null,
      reason: result.missing ? 'ffprobe_missing' : 'ffprobe_failed',
      detail: result.stderr || result.error?.message || '',
    };
  }

  const payload = JSON.parse(result.stdout || '{}');
  const videoStream = Array.isArray(payload.streams)
    ? payload.streams.find(stream => stream.codec_type === 'video')
    : null;

  const width = Number(videoStream?.width ?? 0) || null;
  const height = Number(videoStream?.height ?? 0) || null;
  const durationSeconds =
    Number(videoStream?.duration ?? 0)
    || Number(payload?.format?.duration ?? 0)
    || 0;

  return {
    available: true,
    metadata: {
      width,
      height,
      durationMs: durationSeconds > 0 ? Math.round(durationSeconds * 1000) : null,
      codec: videoStream?.codec_name ?? null,
      bitRate: Number(payload?.format?.bit_rate ?? 0) || null,
    },
    reason: null,
    detail: '',
  };
}

async function createPoster(videoPath, posterPath) {
  const result = await runBinary('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-vf', 'thumbnail,scale=640:-1',
    '-frames:v', '1',
    posterPath,
  ], { timeoutMs: 30000 });

  if (!result.ok) {
    return {
      available: false,
      reason: result.missing ? 'ffmpeg_missing' : 'ffmpeg_failed',
      detail: result.stderr || result.error?.message || '',
    };
  }

  return {
    available: true,
    reason: null,
    detail: '',
  };
}

export async function enrichVideoPublication({
  workspaceId,
  creativeVersionId,
  sourceStorageKey,
}) {
  const videoBuffer = await getObjectBuffer(sourceStorageKey);
  if (!videoBuffer) {
    throw new Error('Could not download source video from object storage');
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'smx-video-'));
  const videoPath = path.join(tempRoot, 'source.mp4');
  const posterPath = path.join(tempRoot, 'poster.jpg');

  try {
    await writeFile(videoPath, videoBuffer);

    const probe = await probeVideoFile(videoPath);
    const poster = await createPoster(videoPath, posterPath);

    const posterArtifacts = [];
    if (poster.available) {
      const posterBuffer = await (await import('node:fs/promises')).readFile(posterPath);
      const storageKey = `${workspaceId}/creative-published/${creativeVersionId}/poster.jpg`;
      const upload = await putObjectBuffer({
        storageKey,
        buffer: posterBuffer,
        contentType: 'image/jpeg',
      });
      posterArtifacts.push({
        kind: 'poster',
        storageKey,
        publicUrl: upload?.publicUrl ?? null,
        mimeType: 'image/jpeg',
        sizeBytes: posterBuffer.byteLength,
        checksum: null,
        metadata: {
          generatedBy: 'ffmpeg',
        },
      });
    }

    return {
      metadata: probe.metadata,
      posterArtifacts,
      processing: {
        ffprobeAvailable: probe.available,
        ffprobeReason: probe.reason,
        ffprobeDetail: probe.detail,
        ffmpegAvailable: poster.available,
        ffmpegReason: poster.reason,
        ffmpegDetail: poster.detail,
      },
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

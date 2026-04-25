import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { getObjectBuffer, putObjectBuffer } from '../storage/object-storage.mjs';

const execFile = promisify(execFileCallback);

function logVideoProcessing(message, extra = null) {
  if (extra) {
    console.log(`[video-processing] ${message}`, extra);
    return;
  }
  console.log(`[video-processing] ${message}`);
}

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

async function downloadBufferFromPublicUrl(url) {
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download source video from public URL (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

function buildRenditionTargets(metadata = {}) {
  const sourceWidth = Number(metadata.width ?? 0) || 0;
  const sourceHeight = Number(metadata.height ?? 0) || 0;
  const sourceBitRate = Number(metadata.bitRate ?? 0) || 0;
  const targets = [
    // Keep the uploaded source MP4 as the highest-quality fallback and generate
    // a lighter ladder for delivery. This avoids redundant 1080p transcodes on
    // small worker instances while still producing streaming-friendly renditions.
    { label: '720p', width: 1280, targetBitrateKbps: 2500, audioBitrateKbps: 160, sortOrder: 20 },
    { label: '480p', width: 854, targetBitrateKbps: 1200, audioBitrateKbps: 128, sortOrder: 30 },
    { label: '360p', width: 640, targetBitrateKbps: 800, audioBitrateKbps: 96, sortOrder: 40 },
  ];
  return targets
    .filter((target) => !sourceWidth || sourceWidth >= target.width)
    .map((target) => {
      const boundedSourceKbps = sourceBitRate > 0 ? Math.max(600, Math.round(sourceBitRate / 1000)) : null;
      const targetBitrateKbps = boundedSourceKbps
        ? Math.min(target.targetBitrateKbps, boundedSourceKbps)
        : target.targetBitrateKbps;
      return {
        ...target,
        targetBitrateKbps,
        sourceWidth,
        sourceHeight,
      };
    });
}

async function transcodeRendition(videoPath, outputPath, target) {
  const maxRateKbps = Math.round(target.targetBitrateKbps * 1.2);
  const bufferSizeKbps = Math.round(target.targetBitrateKbps * 2);
  const result = await runBinary('ffmpeg', [
    '-y',
    '-i', videoPath,
    // Ensure the final encoded frame size is even on both axes for libx264.
    '-vf', `scale=w=${target.width}:h=-2:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'main',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-b:v', `${target.targetBitrateKbps}k`,
    '-maxrate', `${maxRateKbps}k`,
    '-bufsize', `${bufferSizeKbps}k`,
    '-c:a', 'aac',
    '-b:a', `${target.audioBitrateKbps}k`,
    '-ar', '48000',
    outputPath,
  ], { timeoutMs: 600000 });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.missing ? 'ffmpeg_missing' : 'ffmpeg_failed',
      detail: result.stderr || result.error?.message || '',
    };
  }

  return { ok: true, reason: null, detail: '' };
}

export async function enrichVideoPublication({
  workspaceId,
  creativeVersionId,
  sourceStorageKey,
  sourcePublicUrl,
}) {
  const startedAt = Date.now();
  logVideoProcessing(`start creativeVersion=${creativeVersionId} workspace=${workspaceId}`);
  const videoBuffer = sourceStorageKey
    ? await getObjectBuffer(sourceStorageKey)
    : await downloadBufferFromPublicUrl(sourcePublicUrl);
  if (!videoBuffer) {
    throw new Error('Could not download source video from object storage');
  }
  logVideoProcessing(`downloaded source creativeVersion=${creativeVersionId} bytes=${videoBuffer.byteLength}`);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'smx-video-'));
  const videoPath = path.join(tempRoot, 'source.mp4');
  const posterPath = path.join(tempRoot, 'poster.jpg');

  try {
    await writeFile(videoPath, videoBuffer);

    logVideoProcessing(`running ffprobe creativeVersion=${creativeVersionId}`);
    const probe = await probeVideoFile(videoPath);
    logVideoProcessing(`ffprobe finished creativeVersion=${creativeVersionId}`, probe);
    logVideoProcessing(`generating poster creativeVersion=${creativeVersionId}`);
    const poster = await createPoster(videoPath, posterPath);
    logVideoProcessing(`poster generation finished creativeVersion=${creativeVersionId}`, poster);
    const targets = buildRenditionTargets(probe.metadata ?? {});
    logVideoProcessing(`planned rendition targets creativeVersion=${creativeVersionId} count=${targets.length}`, targets);

    const posterArtifacts = [];
    if (poster.available) {
      const posterBuffer = await (await import('node:fs/promises')).readFile(posterPath);
      const storageKey = `${workspaceId}/creative-published/${creativeVersionId}/poster.jpg`;
      logVideoProcessing(`uploading poster creativeVersion=${creativeVersionId} storageKey=${storageKey} bytes=${posterBuffer.byteLength}`);
      const upload = await putObjectBuffer({
        storageKey,
        buffer: posterBuffer,
        contentType: 'image/jpeg',
      });
      logVideoProcessing(`uploaded poster creativeVersion=${creativeVersionId} publicUrl=${upload?.publicUrl ?? 'null'}`);
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

    const renditions = [];
    logVideoProcessing(`uploading source passthrough creativeVersion=${creativeVersionId}`);
    const sourceUpload = await putObjectBuffer({
      storageKey: `${workspaceId}/creative-published/${creativeVersionId}/source.mp4`,
      buffer: videoBuffer,
      contentType: 'video/mp4',
    });
    logVideoProcessing(`uploaded source passthrough creativeVersion=${creativeVersionId} publicUrl=${sourceUpload?.publicUrl ?? 'null'}`);
    renditions.push({
      label: 'Source',
      width: probe.metadata?.width ?? null,
      height: probe.metadata?.height ?? null,
      bitrateKbps: probe.metadata?.bitRate ? Math.round(Number(probe.metadata.bitRate) / 1000) : null,
      codec: probe.metadata?.codec ?? null,
      mimeType: 'video/mp4',
      isSource: true,
      status: 'active',
      sortOrder: 999,
      artifact: {
        kind: 'video_mp4',
        storageKey: `${workspaceId}/creative-published/${creativeVersionId}/source.mp4`,
        publicUrl: sourceUpload?.publicUrl ?? null,
        mimeType: 'video/mp4',
        sizeBytes: videoBuffer.byteLength,
        checksum: null,
        metadata: {
          generatedBy: 'source_passthrough',
          renditionLabel: 'Source',
          isSource: true,
        },
      },
    });

    const renditionProcessing = [];
    for (const target of targets) {
      const outputPath = path.join(tempRoot, `${target.label}.mp4`);
      logVideoProcessing(
        `transcoding rendition creativeVersion=${creativeVersionId} label=${target.label} width=${target.width} bitrateKbps=${target.targetBitrateKbps}`,
      );
      const transcode = await transcodeRendition(videoPath, outputPath, target);
      logVideoProcessing(`transcode finished creativeVersion=${creativeVersionId} label=${target.label}`, transcode);
      renditionProcessing.push({
        label: target.label,
        available: transcode.ok,
        reason: transcode.reason,
        detail: transcode.detail,
      });
      if (!transcode.ok) continue;

      const renditionBuffer = await readFile(outputPath);
      const storageKey = `${workspaceId}/creative-published/${creativeVersionId}/renditions/${target.label}.mp4`;
      logVideoProcessing(`uploading rendition creativeVersion=${creativeVersionId} label=${target.label} bytes=${renditionBuffer.byteLength}`);
      const upload = await putObjectBuffer({
        storageKey,
        buffer: renditionBuffer,
        contentType: 'video/mp4',
      });
      logVideoProcessing(`uploaded rendition creativeVersion=${creativeVersionId} label=${target.label} publicUrl=${upload?.publicUrl ?? 'null'}`);
      const renditionProbe = await probeVideoFile(outputPath);
      logVideoProcessing(`probed transcoded rendition creativeVersion=${creativeVersionId} label=${target.label}`, renditionProbe);
      renditions.push({
        label: target.label,
        width: renditionProbe.metadata?.width ?? null,
        height: renditionProbe.metadata?.height ?? null,
        bitrateKbps: target.targetBitrateKbps,
        codec: renditionProbe.metadata?.codec ?? 'h264',
        mimeType: 'video/mp4',
        isSource: false,
        status: 'active',
        sortOrder: target.sortOrder,
        artifact: {
          kind: 'video_mp4',
          storageKey,
          publicUrl: upload?.publicUrl ?? null,
          mimeType: 'video/mp4',
          sizeBytes: renditionBuffer.byteLength,
          checksum: null,
          metadata: {
            generatedBy: 'ffmpeg',
            renditionLabel: target.label,
            targetWidth: target.width,
            targetBitrateKbps: target.targetBitrateKbps,
          },
        },
      });
    }

    logVideoProcessing(
      `completed creativeVersion=${creativeVersionId} generated=${renditions.filter((rendition) => !rendition.isSource).length} elapsedMs=${Date.now() - startedAt}`,
    );
    return {
      metadata: probe.metadata,
      posterArtifacts,
      renditions,
      processing: {
        source: {
          width: probe.metadata?.width ?? null,
          height: probe.metadata?.height ?? null,
          codec: probe.metadata?.codec ?? null,
          bitRate: probe.metadata?.bitRate ?? null,
        },
        targetPlan: targets.map((target) => ({
          label: target.label,
          width: target.width,
          targetBitrateKbps: target.targetBitrateKbps,
          audioBitrateKbps: target.audioBitrateKbps,
          sortOrder: target.sortOrder,
        })),
        targetCount: targets.length,
        generatedCount: renditions.filter((rendition) => !rendition.isSource).length,
        ffprobeAvailable: probe.available,
        ffprobeReason: probe.reason,
        ffprobeDetail: probe.detail,
        ffmpegAvailable: poster.available,
        ffmpegReason: poster.reason,
        ffmpegDetail: poster.detail,
        renditionProcessing,
        noTargetsReason: targets.length === 0 ? 'source_too_small_or_probe_failed' : null,
      },
    };
  } finally {
    logVideoProcessing(`cleanup creativeVersion=${creativeVersionId} elapsedMs=${Date.now() - startedAt}`);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

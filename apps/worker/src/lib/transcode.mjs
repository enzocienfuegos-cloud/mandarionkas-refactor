import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

const RENDITIONS = [
  { label: '360p',  height: 360,  bitrate: '800k',  audioBitrate: '96k'  },
  { label: '720p',  height: 720,  bitrate: '2500k', audioBitrate: '128k' },
  { label: '1080p', height: 1080, bitrate: '5000k', audioBitrate: '192k' },
];

/**
 * Transcode a video file to HLS with 3 quality renditions.
 *
 * @param {object} opts
 * @param {string} opts.inputPath    - Absolute path to the source video file
 * @param {string} opts.outputDir    - Base output directory; files go into outputDir/{creativeId}/
 * @param {string} opts.creativeId   - Used as subfolder name and in playlist URLs
 * @returns {Promise<{ playlistUrl: string, renditions: Array<{ label, resolution, playlistPath }> }>}
 */
export async function transcodeToHls({ inputPath, outputDir, creativeId }) {
  const creativeDir = path.join(outputDir, creativeId);
  await fs.mkdir(creativeDir, { recursive: true });

  // Probe input to get video dimensions
  const probeData = await probeFile(inputPath);
  const videoStream = probeData.streams?.find(s => s.codec_type === 'video');
  const inputWidth  = videoStream?.width  ?? 1920;
  const inputHeight = videoStream?.height ?? 1080;

  // Transcode each rendition
  const renditionResults = [];
  for (const rendition of RENDITIONS) {
    // Skip renditions that would upscale
    if (rendition.height > inputHeight) continue;

    const scale = Math.round((rendition.height / inputHeight) * inputWidth);
    // Ensure even dimensions for H.264
    const safeWidth  = scale % 2 === 0 ? scale : scale + 1;
    const safeHeight = rendition.height % 2 === 0 ? rendition.height : rendition.height + 1;

    const segmentPattern = path.join(creativeDir, `${rendition.label}_%03d.ts`);
    const playlistPath   = path.join(creativeDir, `${rendition.label}.m3u8`);

    await transcodeRendition({
      inputPath,
      playlistPath,
      segmentPattern,
      width: safeWidth,
      height: safeHeight,
      videoBitrate: rendition.bitrate,
      audioBitrate: rendition.audioBitrate,
    });

    renditionResults.push({
      label: rendition.label,
      resolution: `${safeWidth}x${safeHeight}`,
      playlistPath,
      bandwidth: parseBitrate(rendition.bitrate),
    });
  }

  // Build master playlist
  const masterPlaylistPath = path.join(creativeDir, 'master.m3u8');
  const masterContent = buildMasterPlaylist(renditionResults, creativeId);
  await fs.writeFile(masterPlaylistPath, masterContent, 'utf8');

  return {
    playlistUrl: `${creativeId}/master.m3u8`,
    renditions: renditionResults.map(r => ({
      label: r.label,
      resolution: r.resolution,
      playlistPath: r.playlistPath,
    })),
  };
}

function probeFile(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function transcodeRendition({ inputPath, playlistPath, segmentPattern, width, height, videoBitrate, audioBitrate }) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .videoBitrate(videoBitrate)
      .audioBitrate(audioBitrate)
      .size(`${width}x${height}`)
      .outputOptions([
        '-preset veryfast',
        '-profile:v main',
        '-level 3.1',
        '-sc_threshold 0',
        '-g 48',
        '-keyint_min 48',
        '-hls_time 6',
        '-hls_playlist_type vod',
        '-hls_flags independent_segments',
        `-hls_segment_filename ${segmentPattern}`,
      ])
      .output(playlistPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function parseBitrate(bitrateStr) {
  // Convert '2500k' -> 2500000, '5000k' -> 5000000
  const match = bitrateStr.match(/^(\d+)k$/i);
  if (match) return parseInt(match[1], 10) * 1000;
  const numMatch = bitrateStr.match(/^(\d+)$/);
  if (numMatch) return parseInt(numMatch[1], 10);
  return 0;
}

function buildMasterPlaylist(renditions, creativeId) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3', ''];

  for (const r of renditions) {
    const [w, h] = r.resolution.split('x').map(Number);
    const bandwidth = r.bandwidth;
    const playlistName = path.basename(r.playlistPath);

    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${w}x${h},NAME="${r.label}"`);
    lines.push(playlistName);
    lines.push('');
  }

  return lines.join('\n');
}

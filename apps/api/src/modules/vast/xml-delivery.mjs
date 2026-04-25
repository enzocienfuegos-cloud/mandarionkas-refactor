import { getTagServingSnapshot } from '@smx/db/tags';
import {
  getDspMacroConfig,
  normalizeDsp,
  wrapTrackedClickUrlWithDspMacro,
} from '@smx/contracts/dsp-macros';
import { getObjectBuffer, putObjectBuffer } from '../storage/object-storage.mjs';
import {
  buildStaticVastManifestPublicUrl,
  buildStaticVastManifestStorageKey,
  buildStaticVastProfile,
  buildStaticVastPublicUrl,
  buildStaticVastStorageKey,
  buildStaticVastTemplateQuery,
} from './delivery-artifacts.mjs';

function encodeContextToken(payload = {}) {
  try {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch {
    return '';
  }
}

function appendQueryParam(url, key, value) {
  if (!url || !value) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${key}=${encodeURIComponent(String(value))}`;
}

export function readRequestedSize(query = {}) {
  const width = Number(query?.width ?? query?.w ?? 0);
  const height = Number(query?.height ?? query?.h ?? 0);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  return { width, height };
}

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildVastXml(tag, workspaceId, baseUrl, query = {}) {
  const tagId = tag.id;
  const servingCandidate = tag.servingCandidate ?? null;
  const creativeId = servingCandidate?.creativeId ?? 'no-creative';
  const creativeSizeVariantId = servingCandidate?.creativeSizeVariantId ?? null;
  const videoUrl = servingCandidate?.publicUrl ?? '';
  const clickUrl = servingCandidate?.clickUrl ?? '';
  const duration = servingCandidate?.durationMs
    ? formatDuration(servingCandidate.durationMs)
    : '00:00:30';
  const width = servingCandidate?.width ?? 1920;
  const height = servingCandidate?.height ?? 1080;
  const trackingParams = new URLSearchParams({ ws: String(workspaceId) });
  const trackingDsp = normalizeDsp(query?.smx_dsp ?? query?.dsp);
  if (trackingDsp) trackingParams.set('smx_dsp', String(trackingDsp));
  trackingParams.set('smx_delivery_kind', 'vast');
  if (creativeId) trackingParams.set('c', String(creativeId));
  if (creativeSizeVariantId) trackingParams.set('csv', String(creativeSizeVariantId));
  const ctxToken = encodeContextToken(query);
  const impressionUrl = appendQueryParam(`${baseUrl}/track/impression/${tagId}?${trackingParams.toString()}`, 'ctx', ctxToken);
  const trackingBase = `${baseUrl}/track`;
  const clickTrackingParams = new URLSearchParams(trackingParams);
  const clickTrackingUrl = appendQueryParam(`${trackingBase}/click/${tagId}?${clickTrackingParams.toString()}`, 'ctx', ctxToken);
  const wrappedClickTrackUrl = wrapTrackedClickUrlWithDspMacro(clickTrackingUrl, query);
  const viewabilityBaseUrl = appendQueryParam(`${trackingBase}/viewability/${tagId}?${trackingParams.toString()}`, 'ctx', ctxToken);
  const vastVersion = trackingDsp === 'basis' ? '2.0' : '4.0';
  const clickThroughUrl = clickUrl || wrappedClickTrackUrl || clickTrackingUrl;
  const mediaFiles = Array.isArray(servingCandidate?.videoRenditions) && servingCandidate.videoRenditions.length
    ? servingCandidate.videoRenditions
      .filter((rendition) => rendition?.public_url)
      .filter((rendition) => ['active', 'draft', 'paused'].includes(String(rendition?.status ?? '').toLowerCase()))
      .sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0))
    : [];
  const mediaFilesXml = (mediaFiles.length ? mediaFiles : [{
    public_url: videoUrl,
    mime_type: 'video/mp4',
    width,
    height,
    bitrate_kbps: null,
  }]).map((rendition) => {
    const renditionWidth = rendition?.width ?? width;
    const renditionHeight = rendition?.height ?? height;
    const bitrateAttr = rendition?.bitrate_kbps ? ` bitrate="${rendition.bitrate_kbps}"` : '';
    const typeAttr = escapeXml(rendition?.mime_type ?? 'video/mp4');
    return `              <MediaFile delivery="progressive" type="${typeAttr}" width="${renditionWidth}" height="${renditionHeight}"${bitrateAttr}>
                <![CDATA[${rendition.public_url}]]>
              </MediaFile>`;
  }).join('\n');
  const clickThroughXml = clickUrl
    ? `              <ClickThrough><![CDATA[${clickThroughUrl}]]></ClickThrough>\n`
    : (trackingDsp === 'basis'
      ? `              <ClickThrough><![CDATA[${clickThroughUrl}]]></ClickThrough>\n`
      : '');
  const errorXml = trackingDsp === 'basis'
    ? `      <Error><![CDATA[${appendQueryParam(`${trackingBase}/viewability/${tagId}?${trackingParams.toString()}`, 'event', '[ERRORCODE]')}]]></Error>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="${vastVersion}">
  <Ad id="${tagId}">
    <InLine>
      <AdSystem><![CDATA[SMX Studio]]></AdSystem>
      <AdTitle><![CDATA[${escapeXml(tag.name)}]]></AdTitle>
${errorXml}
      <Impression id="smx-imp"><![CDATA[${impressionUrl}]]></Impression>
      <Creatives>
        <Creative id="${creativeId}" sequence="1">
          <Linear>
            <Duration>${duration}</Duration>
            <TrackingEvents>
              <Tracking event="start"><![CDATA[${appendQueryParam(viewabilityBaseUrl, 'event', 'start')}]]></Tracking>
              <Tracking event="firstQuartile"><![CDATA[${appendQueryParam(viewabilityBaseUrl, 'event', 'firstQuartile')}]]></Tracking>
              <Tracking event="midpoint"><![CDATA[${appendQueryParam(viewabilityBaseUrl, 'event', 'midpoint')}]]></Tracking>
              <Tracking event="thirdQuartile"><![CDATA[${appendQueryParam(viewabilityBaseUrl, 'event', 'thirdQuartile')}]]></Tracking>
              <Tracking event="complete"><![CDATA[${appendQueryParam(viewabilityBaseUrl, 'event', 'complete')}]]></Tracking>
            </TrackingEvents>
            <VideoClicks>
${clickThroughXml}
              <ClickTracking><![CDATA[${wrappedClickTrackUrl}]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
${mediaFilesXml}
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
}

export async function publishStaticVastArtifactsForTag({
  pool,
  workspaceId,
  tagId,
  baseUrl,
  requestedSize = null,
  dspProfiles = ['', 'basis', 'illumin'],
  trigger = 'manual',
} = {}) {
  if (!pool || !workspaceId || !tagId || !baseUrl) return [];

  const tag = await getTagServingSnapshot(pool, workspaceId, tagId, { requestedSize });
  if (!tag || (tag.format !== 'vast' && tag.format !== 'vast_video')) return [];

  const published = [];
  for (const dsp of dspProfiles) {
    const normalizedDsp = normalizeDsp(dsp);
    if (normalizedDsp && !getDspMacroConfig(normalizedDsp)) continue;
    const profile = buildStaticVastProfile(normalizedDsp);
    const xml = buildVastXml(
      tag,
      workspaceId,
      baseUrl,
      buildStaticVastTemplateQuery(normalizedDsp),
    );
    const storageKey = buildStaticVastStorageKey(workspaceId, tagId, normalizedDsp);
    await putObjectBuffer({
      storageKey,
      buffer: Buffer.from(xml, 'utf8'),
      contentType: 'application/xml; charset=utf-8',
    });
    published.push({
      kind: 'vast_xml',
      tagId,
      workspaceId,
      dsp: normalizedDsp || null,
      profile,
      storageKey,
      publicUrl: buildStaticVastPublicUrl(workspaceId, tagId, normalizedDsp),
      xmlVersion: normalizedDsp === 'basis' ? '2.0' : '4.0',
    });
  }

  if (published.length) {
    const manifestStorageKey = buildStaticVastManifestStorageKey(workspaceId, tagId);
    let previousManifest = null;
    try {
      const existing = await getObjectBuffer(manifestStorageKey);
      if (existing) {
        previousManifest = JSON.parse(Buffer.from(existing).toString('utf8'));
      }
    } catch {
      previousManifest = null;
    }
    const generatedAt = new Date().toISOString();
    const nextHistoryEntry = {
      generatedAt,
      trigger,
      requestedSize: requestedSize ?? null,
      profileCount: published.length,
      profiles: published.map((entry) => ({
        profile: entry.profile,
        dsp: entry.dsp,
        xmlVersion: entry.xmlVersion,
      })),
    };
    const priorHistory = Array.isArray(previousManifest?.history) ? previousManifest.history : [];
    const history = [nextHistoryEntry, ...priorHistory].slice(0, 10);

    const manifest = {
      tagId,
      workspaceId,
      generatedAt,
      trigger,
      baseUrl,
      requestedSize: requestedSize ?? null,
      profiles: published.map((entry) => ({
        profile: entry.profile,
        dsp: entry.dsp,
        publicUrl: entry.publicUrl,
        storageKey: entry.storageKey,
        xmlVersion: entry.xmlVersion,
      })),
      previousGeneratedAt: previousManifest?.generatedAt ?? null,
      previousTrigger: previousManifest?.trigger ?? null,
      history,
    };

    await putObjectBuffer({
      storageKey: manifestStorageKey,
      buffer: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
      contentType: 'application/json; charset=utf-8',
    });

    for (const entry of published) {
      entry.manifestPublicUrl = buildStaticVastManifestPublicUrl(workspaceId, tagId);
      entry.generatedAt = manifest.generatedAt;
      entry.trigger = trigger;
    }
  }

  return published;
}

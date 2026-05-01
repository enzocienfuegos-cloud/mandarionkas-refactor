import { createHash, randomUUID } from 'node:crypto';
import {
  applyDspMacrosToDeliveryUrl,
  DSP_DELIVERY_KINDS,
  getDspDeliveryPolicy,
  readCampaignDsp,
  shouldUseDspVideoDelivery,
} from '../../contracts/src/dsp-macros.mjs';
import { listVideoRenditions } from './creatives.mjs';

const PROFILE_XML_VERSION = {
  default: '4.2',
  basis: '4.2',
  illumin: '4.2',
  vast4: '4.2',
};

const EMPTY_STATIC_METADATA = Object.freeze({
  snapshots: {},
  staticProfiles: {},
  staticProfileStatus: {},
  manifest: null,
  job: null,
});

let hasTagFormatConfigMetadataColumn = null;

function trimText(value) {
  return String(value ?? '').trim();
}

function normalizeProfile(value, fallback = 'default') {
  const normalized = trimText(value).toLowerCase();
  if (normalized === 'basis') return 'basis';
  if (normalized === 'illumin') return 'illumin';
  if (normalized === 'vast4' || normalized === 'vast-4' || normalized === '4.2') return 'vast4';
  if (normalized === 'default' || normalized === 'standard' || normalized === 'smx') return 'default';
  return fallback;
}

function normalizeStaticProfile(value, fallback = 'default') {
  const normalized = normalizeProfile(value, fallback);
  return normalized === 'vast4' ? 'default' : normalized;
}

function deriveProfileDsp(profile, campaignDsp = '') {
  if (profile === 'basis') return 'basis';
  if (profile === 'illumin') return 'illumin';
  const normalizedCampaignDsp = readCampaignDsp({ dsp: campaignDsp });
  return normalizedCampaignDsp || '';
}

function hashEtag(value) {
  return createHash('sha1').update(String(value || '')).digest('hex');
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${[hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')}.000`;
}

function extractJsonObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...fallback };
  return { ...fallback, ...value };
}

function parseStaticDeliveryMetadata(metadata) {
  const vastDelivery = extractJsonObject(metadata?.vastDelivery, {});
  return {
    snapshots: extractJsonObject(vastDelivery.snapshots, {}),
    staticProfiles: extractJsonObject(vastDelivery.staticProfiles, {}),
    staticProfileStatus: extractJsonObject(vastDelivery.staticProfileStatus, {}),
    manifest: vastDelivery.manifest && typeof vastDelivery.manifest === 'object' ? vastDelivery.manifest : null,
    job: vastDelivery.job && typeof vastDelivery.job === 'object' ? vastDelivery.job : null,
  };
}

function buildStaticDeliveryMetadata(existingMetadata = {}, nextState) {
  const nextMetadata = extractJsonObject(existingMetadata, {});
  nextMetadata.vastDelivery = nextState;
  return nextMetadata;
}

function buildLiveProfileUrl(baseUrl, tagId, profile) {
  const normalizedBaseUrl = trimText(baseUrl).replace(/\/+$/, '');
  if (!normalizedBaseUrl) return '';
  if (profile === 'default') return `${normalizedBaseUrl}/v1/vast/tags/${tagId}/default.xml`;
  if (profile === 'basis') return `${normalizedBaseUrl}/v1/vast/tags/${tagId}/basis.xml`;
  if (profile === 'illumin') return `${normalizedBaseUrl}/v1/vast/tags/${tagId}/illumin.xml`;
  return `${normalizedBaseUrl}/v1/vast/tags/${tagId}/vast4.xml`;
}

function buildStaticProfileUrl(baseUrl, tagId, profile) {
  const normalizedBaseUrl = trimText(baseUrl).replace(/\/+$/, '');
  if (!normalizedBaseUrl) return '';
  return `${normalizedBaseUrl}/v1/vast/tags/${tagId}/static/${profile}.xml`;
}

function getProfileVersion(profile, configuredVersion) {
  if (profile === 'default') return trimText(configuredVersion) || PROFILE_XML_VERSION.default;
  return PROFILE_XML_VERSION[profile] || PROFILE_XML_VERSION.default;
}

function xmlEscapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value) {
  const text = String(value ?? '');
  return `<![CDATA[${text.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function extractSourceInfo(version = {}, renditionRows = []) {
  const source = renditionRows.find((row) => row.is_source) ?? null;
  const versionMetadata = extractJsonObject(version?.metadata || version?.creative_version_metadata, {});
  const versionVideoProcessing = extractJsonObject(versionMetadata.videoProcessing, {});
  const versionVideoSource = extractJsonObject(versionVideoProcessing.source, {});
  const targetPlan = Array.isArray(versionVideoProcessing.targetPlan) ? versionVideoProcessing.targetPlan : [];
  const largestTarget = [...targetPlan].sort((left, right) => Number(right.height || 0) - Number(left.height || 0))[0] || {};
  const sourceMetadata = extractJsonObject(source?.metadata, {});
  return {
    width: source?.width ?? version.width ?? versionVideoSource.width ?? versionMetadata.width ?? sourceMetadata.width ?? largestTarget.width ?? null,
    height: source?.height ?? version.height ?? versionVideoSource.height ?? versionMetadata.height ?? sourceMetadata.height ?? largestTarget.height ?? null,
    mimeType: source?.mime_type ?? version.mime_type ?? versionVideoSource.mimeType ?? versionMetadata.mimeType ?? sourceMetadata.mimeType ?? null,
    durationMs: version.duration_ms ?? versionVideoSource.durationMs ?? versionMetadata.durationMs ?? sourceMetadata.durationMs ?? null,
  };
}

function buildRenditionPlan(version = {}, renditionRows = []) {
  const sourceInfo = extractSourceInfo(version, renditionRows);
  const activeRows = renditionRows
    .filter((row) => {
      if (row.status !== 'active' || !row.public_url) return false;
      if (row.is_source) return true;
      const metadata = extractJsonObject(row.metadata, {});
      return metadata.available === true && Number(row.size_bytes || 0) > 0;
    })
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));

  const sources = activeRows.filter((row) => row.is_source);
  const transcoded = activeRows.filter((row) => !row.is_source);
  const ordered = [...transcoded, ...sources].filter((row, index, all) => all.findIndex((entry) => entry.id === row.id) === index);

  const fromRows = ordered.map((row) => ({
    label: normalizeRenditionLabel(row.label),
    url: row.public_url,
    width: row.width ?? sourceInfo.width ?? null,
    height: row.height ?? sourceInfo.height ?? null,
    bitrateKbps: row.bitrate_kbps ?? null,
    codec: row.codec ?? 'h264',
    mimeType: row.mime_type ?? sourceInfo.mimeType ?? 'video/mp4',
    isSource: Boolean(row.is_source),
  }));

  const merged = [...fromRows];
  const seen = new Set(fromRows.map((row) => trimText(row.url)));
  for (const row of buildMetadataBackedRenditionPlan(version)) {
    if (seen.has(trimText(row.url))) continue;
    seen.add(trimText(row.url));
    merged.push(row);
  }

  return merged.sort((left, right) => {
    const leftRank = left.isSource ? 99 : renditionSortOrder(left.label);
    const rightRank = right.isSource ? 99 : renditionSortOrder(right.label);
    return leftRank - rightRank;
  });
}

function buildTrackingEventUrls(engagementUrl) {
  const safeUrl = trimText(engagementUrl);
  if (!safeUrl) return [];
  const events = [
    'creativeView',
    'start',
    'firstQuartile',
    'midpoint',
    'thirdQuartile',
    'complete',
    'mute',
    'unmute',
    'pause',
    'resume',
    'fullscreen',
    'closeLinear',
  ];
  return events.map((event) => ({
    event,
    url: `${safeUrl}?event=${encodeURIComponent(event)}`,
  }));
}

function estimateBitrateKbps(width, height) {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (!w || !h) return null;
  const pixels = w * h;
  if (pixels >= 1920 * 1080) return 5000;
  if (pixels >= 1280 * 720) return 2800;
  if (pixels >= 854 * 480) return 1400;
  return 800;
}

function renditionSortOrder(label = '') {
  const normalized = trimText(label).toLowerCase();
  if (normalized === '1080p' || normalized === 'high') return 10;
  if (normalized === '720p' || normalized === 'mid') return 20;
  if (normalized === '480p' || normalized === 'low') return 30;
  if (normalized === '360p') return 40;
  if (normalized === 'source') return 99;
  return 50;
}

function normalizeRenditionLabel(label = '') {
  const normalized = trimText(label);
  if (!normalized) return '';
  const lower = normalized.toLowerCase();
  if (lower === 'high') return '1080p';
  if (lower === 'mid') return '720p';
  if (lower === 'low') return '480p';
  return normalized;
}

function renditionLabelAliases(label = '') {
  const normalized = normalizeRenditionLabel(label).toLowerCase();
  if (normalized === '1080p') return ['1080p', 'high'];
  if (normalized === '720p') return ['720p', 'mid'];
  if (normalized === '480p') return ['480p', 'low'];
  return [normalized];
}

function buildMetadataBackedRenditionPlan(version = {}) {
  const versionMetadata = extractJsonObject(version?.metadata || version?.creative_version_metadata, {});
  const processing = extractJsonObject(versionMetadata.videoProcessing, {});
  const targetPlan = Array.isArray(processing.targetPlan) ? processing.targetPlan : [];
  const processingRows = Array.isArray(processing.renditionProcessing) ? processing.renditionProcessing : [];
  const byLabel = new Map(
    processingRows.map((row) => [trimText(row.label).toLowerCase(), row]).filter(([key]) => key),
  );

  return targetPlan
    .map((profile) => {
      const row = renditionLabelAliases(profile.label)
        .map((alias) => byLabel.get(alias))
        .find(Boolean) || null;
      const publicUrl = trimText(row?.publicUrl);
      const status = trimText(row?.status).toLowerCase();
      if (!publicUrl || !['active', 'ready', 'completed'].includes(status)) return null;
      return {
        label: normalizeRenditionLabel(profile.label),
        url: publicUrl,
        width: Number(profile.width || 0) || null,
        height: Number(profile.height || 0) || null,
        bitrateKbps: Number(profile.bitrateKbps || 0) || estimateBitrateKbps(profile.width, profile.height),
        codec: 'h264',
        mimeType: 'video/mp4',
        isSource: false,
      };
    })
    .filter(Boolean)
    .sort((left, right) => renditionSortOrder(left.label) - renditionSortOrder(right.label));
}

function formatXmlAttributes(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}="${xmlEscapeText(value)}"`)
    .join(' ');
}

function buildXmlRootAttributes(xmlVersion) {
  const version = trimText(xmlVersion) || '4.2';
  if (version.startsWith('4')) {
    return [
      `version="${xmlEscapeText(version)}"`,
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      'xsi:noNamespaceSchemaLocation="https://iabtechlab.com/wp-content/uploads/2019/06/VAST_4.2.xsd"',
    ].join(' ');
  }
  return `version="${xmlEscapeText(version)}"`;
}

function normalizeMediaFiles(mediaFiles = [], source = {}) {
  const unique = [];
  const seen = new Set();
  for (const file of mediaFiles) {
    const url = trimText(file?.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push({
      id: trimText(file?.label || `rendition-${unique.length + 1}`),
      label: trimText(file?.label || ''),
      url,
      width: Number(file?.width || source.width || 0) || null,
      height: Number(file?.height || source.height || 0) || null,
      bitrateKbps: Number(file?.bitrateKbps || 0) || estimateBitrateKbps(file?.width || source.width, file?.height || source.height),
      codec: trimText(file?.codec || source.codec || ''),
      mimeType: trimText(file?.mimeType || source.mimeType || 'video/mp4') || 'video/mp4',
      isSource: Boolean(file?.isSource),
    });
  }

  if (!unique.length && trimText(source.url)) {
    unique.push({
      id: 'source',
      label: 'Source',
      url: trimText(source.url),
      width: Number(source.width || 0) || null,
      height: Number(source.height || 0) || null,
      bitrateKbps: Number(source.bitrateKbps || 0) || estimateBitrateKbps(source.width, source.height),
      codec: trimText(source.codec || ''),
      mimeType: trimText(source.mimeType || 'video/mp4') || 'video/mp4',
      isSource: true,
    });
  }

  return unique;
}

function buildImpressionXml(impressionUrls = []) {
  return impressionUrls.map((url, index) => `      <Impression${index === 0 ? ' id="smx-imp"' : ''}>${cdata(url)}</Impression>`).join('\n');
}

function buildMediaFileXml(mediaFiles = []) {
  return mediaFiles.map((file, index) => {
    const attrs = formatXmlAttributes({
      id: file.id || `media-${index + 1}`,
      delivery: 'progressive',
      type: file.mimeType || 'video/mp4',
      width: file.width,
      height: file.height,
      bitrate: file.bitrateKbps,
      codec: file.codec || undefined,
      scalable: 'true',
      maintainAspectRatio: 'true',
    });
    return `              <MediaFile ${attrs}>${cdata(file.url)}</MediaFile>`;
  }).join('\n');
}

function buildTrackingEventsXml(trackingEvents = []) {
  return trackingEvents.map(({ event, url }) => `              <Tracking event="${xmlEscapeText(event)}">${cdata(url)}</Tracking>`).join('\n');
}

function buildWrapperXml({
  tagId,
  targetUrl,
  impressionUrls = [],
  errorUrl = '',
  clickTrackingUrls = [],
  clickThroughUrl,
  xmlVersion,
  adTitle,
}) {
  const rootAttributes = buildXmlRootAttributes(xmlVersion);
  const impressionXml = buildImpressionXml(impressionUrls);
  const clickTrackingXml = clickTrackingUrls.map((url) => `              <ClickTracking>${cdata(url)}</ClickTracking>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST ${rootAttributes}>
  <Ad id="${xmlEscapeText(tagId)}">
    <Wrapper followAdditionalWrappers="true" allowMultipleAds="true" fallbackOnNoAd="true">
      <AdSystem version="1.0">SMX Studio</AdSystem>
      <AdTitle>${cdata(adTitle)}</AdTitle>
      ${errorUrl ? `<Error>${cdata(errorUrl)}</Error>` : ''}
${impressionXml}
      <Creatives>
        <Creative id="${xmlEscapeText(`${tagId}-creative`)}" sequence="1">
          <Linear>
            <TrackingEvents>
              <Tracking event="creativeView">${cdata(impressionUrls[0] || '')}</Tracking>
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough>${cdata(clickThroughUrl)}</ClickThrough>
${clickTrackingXml}
            </VideoClicks>
          </Linear>
        </Creative>
      </Creatives>
      <VASTAdTagURI>${cdata(targetUrl)}</VASTAdTagURI>
    </Wrapper>
  </Ad>
</VAST>`;
}

function buildInlineXml({
  tagId,
  adTitle,
  xmlVersion,
  impressionUrls = [],
  errorUrl = '',
  clickTrackingUrls = [],
  clickThroughUrl,
  durationMs,
  mediaFiles = [],
  source = {},
  trackingEvents = [],
}) {
  const rootAttributes = buildXmlRootAttributes(xmlVersion);
  const normalizedMediaFiles = normalizeMediaFiles(mediaFiles, source);
  const mediaFileXml = buildMediaFileXml(normalizedMediaFiles);
  const impressionXml = buildImpressionXml(impressionUrls);
  const trackingEventsXml = buildTrackingEventsXml(trackingEvents);
  const clickTrackingXml = clickTrackingUrls.map((url) => `              <ClickTracking>${cdata(url)}</ClickTracking>`).join('\n');
  const creativeAttributes = formatXmlAttributes({
    id: `${tagId}-creative`,
    sequence: 1,
  });
  const hasUniversalId = trimText(xmlVersion).startsWith('4');
  const hasVast4 = trimText(xmlVersion).startsWith('4');
  const adServingId = randomUUID();
  const viewableUrl = trackingEvents.find((row) => row.event === 'creativeView')?.url || impressionUrls[0] || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST ${rootAttributes}>
  <Ad id="${xmlEscapeText(tagId)}">
    <InLine>
      <AdSystem version="1.0">SMX Studio</AdSystem>
      <AdTitle>${cdata(adTitle)}</AdTitle>
      ${hasVast4 ? `<AdServingId>${xmlEscapeText(adServingId)}</AdServingId>` : ''}
      ${errorUrl ? `<Error>${cdata(errorUrl)}</Error>` : ''}
${impressionXml}
      ${hasVast4 && viewableUrl ? `<ViewableImpression><Viewable>${cdata(viewableUrl)}</Viewable></ViewableImpression>` : ''}
      <Creatives>
        <Creative ${creativeAttributes}>
          ${hasUniversalId ? `<UniversalAdId idRegistry="smx-studio">${xmlEscapeText(tagId)}</UniversalAdId>` : ''}
          <Linear>
            <Duration>${formatDuration(durationMs)}</Duration>
            <TrackingEvents>
${trackingEventsXml}
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough>${cdata(clickThroughUrl)}</ClickThrough>
${clickTrackingXml}
            </VideoClicks>
            <MediaFiles>
${mediaFileXml}
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
}

function parseVastXml(xml) {
  const source = String(xml || '');
  const vastMatch = source.match(/<VAST\b[^>]*version=["']([^"']+)["']/i);
  const type = /<Wrapper\b/i.test(source) ? 'Wrapper' : /<InLine\b/i.test(source) ? 'InLine' : 'Unknown';
  const tagUriMatch = source.match(/<VASTAdTagURI\b[^>]*>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+))\s*<\/VASTAdTagURI>/i);
  const mediaFiles = source.match(/<MediaFile\b/gi) ?? [];
  const impressions = source.match(/<Impression\b/gi) ?? [];
  const adSystemMatch = source.match(/<AdSystem\b[^>]*>\s*(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+))\s*<\/AdSystem>/i);
  return {
    vastVersion: vastMatch?.[1] ?? null,
    type,
    wrapperUrl: trimText(tagUriMatch?.[1] ?? tagUriMatch?.[2] ?? ''),
    mediaFileCount: mediaFiles.length,
    impressionCount: impressions.length,
    adSystem: trimText(adSystemMatch?.[1] ?? adSystemMatch?.[2] ?? ''),
  };
}

async function fetchUrlText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'smx-studio-api/vast-validator',
      Accept: 'application/xml,text/xml,application/xhtml+xml,text/plain,*/*',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch remote VAST (${response.status})`);
  }
  return response.text();
}

async function tagFormatConfigHasMetadataColumn(pool) {
  if (hasTagFormatConfigMetadataColumn !== null) return hasTagFormatConfigMetadataColumn;
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tag_format_configs'
       AND column_name = 'metadata'
     LIMIT 1`,
  );
  hasTagFormatConfigMetadataColumn = rows.length > 0;
  return hasTagFormatConfigMetadataColumn;
}

export async function validateVastTag({ xml = '', url = '' }) {
  const sourceUrl = trimText(url);
  const sourceXml = trimText(xml) || (sourceUrl ? await fetchUrlText(sourceUrl) : '');
  const issues = [];
  const warnings = [];

  if (!sourceXml) {
    return {
      valid: false,
      vastVersion: null,
      errors: ['VAST XML is required.'],
      warnings: [],
    };
  }

  const parsed = parseVastXml(sourceXml);
  if (!parsed.vastVersion) issues.push('Missing <VAST version="..."> root.');
  if (parsed.type === 'Unknown') issues.push('VAST payload does not contain an <InLine> or <Wrapper> creative.');
  if (parsed.type === 'Wrapper' && !parsed.wrapperUrl) issues.push('Wrapper VAST is missing <VASTAdTagURI>.');
  if (parsed.type === 'InLine' && parsed.mediaFileCount === 0) issues.push('Inline VAST does not contain any <MediaFile> entries.');
  if (parsed.impressionCount === 0) warnings.push('No <Impression> tracking URL found.');
  if (parsed.type === 'Wrapper' && !parsed.impressionCount) warnings.push('Wrapper VAST has no wrapper-level impression tracker.');
  if ((sourceXml.match(/<VASTAdTagURI\b/gi) ?? []).length > 1) {
    warnings.push('Multiple wrapper tag URIs found; only the first will be used by the foundation resolver.');
  }

  return {
    valid: issues.length === 0,
    vastVersion: parsed.vastVersion,
    errors: issues,
    warnings,
  };
}

export async function resolveVastChain({ url, maxDepth = 10 }) {
  const startUrl = trimText(url);
  if (!startUrl) {
    return { resolved: false, totalDepth: 0, steps: [], finalType: null, error: 'VAST tag URL is required.' };
  }

  const steps = [];
  const visited = new Set();
  let currentUrl = startUrl;
  let finalType = null;
  let resolved = false;
  let error = null;

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    if (visited.has(currentUrl)) {
      error = 'Wrapper loop detected.';
      break;
    }
    visited.add(currentUrl);

    try {
      const xml = await fetchUrlText(currentUrl);
      const parsed = parseVastXml(xml);
      finalType = parsed.type;
      const step = {
        depth,
        url: currentUrl,
        type: parsed.type === 'Unknown' ? 'Unknown' : parsed.type,
        vastVersion: parsed.vastVersion ?? '',
        adSystem: parsed.adSystem || null,
      };

      if (parsed.type === 'Wrapper') {
        if (!parsed.wrapperUrl) {
          steps.push({ ...step, error: 'Wrapper did not include <VASTAdTagURI>.' });
          error = 'Wrapper did not include <VASTAdTagURI>.';
          break;
        }
        steps.push(step);
        currentUrl = parsed.wrapperUrl;
        continue;
      }

      steps.push(step);
      resolved = parsed.type === 'InLine';
      if (!resolved && !error) {
        error = 'Unable to determine final VAST creative type.';
      }
      break;
    } catch (err) {
      error = err?.message || 'Failed to resolve wrapper chain.';
      steps.push({
        depth,
        url: currentUrl,
        type: 'Unknown',
        vastVersion: '',
        adSystem: null,
        error,
      });
      break;
    }
  }

  if (!resolved && !error && steps.length >= maxDepth) {
    error = `Wrapper chain exceeded max depth of ${maxDepth}.`;
  }

  return {
    resolved,
    totalDepth: steps.length,
    steps,
    finalType,
    error,
  };
}

async function getTagContext(pool, tagId) {
  const hasMetadataColumn = await tagFormatConfigHasMetadataColumn(pool);
  const { rows } = await pool.query(
    `SELECT t.id, t.workspace_id, t.campaign_id, t.name, t.format, t.status,
            t.click_url, t.impression_url, t.targeting, t.created_at, t.updated_at,
            c.name AS campaign_name,
            c.metadata AS campaign_metadata,
            tfc.vast_version, tfc.vast_wrapper, tfc.vast_url,
            ${hasMetadataColumn ? "tfc.metadata" : "'{}'::jsonb"} AS format_metadata
     FROM ad_tags t
     LEFT JOIN campaigns c ON c.id = t.campaign_id
     LEFT JOIN tag_format_configs tfc ON tfc.tag_id = t.id
     WHERE t.id = $1`,
    [tagId],
  );
  const tag = rows[0] ?? null;
  if (!tag) return null;

  const { rows: bindingRows } = await pool.query(
    `SELECT b.id, b.tag_id, b.creative_version_id, b.creative_size_variant_id, b.status, b.weight,
            cv.creative_id, cv.source_kind, cv.serving_format, cv.status AS creative_version_status,
            cv.public_url, cv.mime_type, cv.width, cv.height, cv.duration_ms, cv.metadata AS creative_version_metadata,
            c.name AS creative_name, c.click_url AS creative_click_url, c.transcode_status,
            v.label AS variant_label, v.width AS variant_width, v.height AS variant_height,
            v.status AS variant_status, v.public_url AS variant_public_url
     FROM creative_tag_bindings b
     JOIN creative_versions cv
       ON cv.id = b.creative_version_id
      AND cv.workspace_id = b.workspace_id
     JOIN creatives c
       ON c.id = cv.creative_id
      AND c.workspace_id = b.workspace_id
     LEFT JOIN creative_size_variants v
       ON v.id = b.creative_size_variant_id
      AND v.workspace_id = b.workspace_id
     WHERE b.workspace_id = $1
       AND b.tag_id = $2
       AND b.status = 'active'
     ORDER BY b.weight DESC, b.created_at ASC`,
    [tag.workspace_id, tagId],
  );

  const selectedBinding = bindingRows[0] ?? null;
  const renditions = selectedBinding
    ? await listVideoRenditions(pool, tag.workspace_id, selectedBinding.creative_version_id)
    : [];

  const { rows: pixelRows } = await pool.query(
    `SELECT id, pixel_type, url
     FROM tag_pixels
     WHERE tag_id = $1
     ORDER BY created_at ASC`,
    [tagId],
  );

  return {
    tag,
    selectedBinding,
    renditions,
    pixels: pixelRows,
  };
}

function buildTrackerUrls({ baseUrl, tagId, dsp = '' }) {
  const rawImpression = `${baseUrl}/v1/tags/tracker/${tagId}/impression.gif`;
  const rawClick = `${baseUrl}/v1/tags/tracker/${tagId}/click`;
  const rawEngagement = `${baseUrl}/v1/tags/tracker/${tagId}/engagement`;
  if (!trimText(dsp)) {
    return {
      impression: rawImpression,
      click: rawClick,
      engagement: rawEngagement,
    };
  }
  return {
    impression: applyDspMacrosToDeliveryUrl(rawImpression, dsp, DSP_DELIVERY_KINDS.TRACKER_IMPRESSION),
    click: applyDspMacrosToDeliveryUrl(rawClick, dsp, DSP_DELIVERY_KINDS.TRACKER_CLICK),
    engagement: applyDspMacrosToDeliveryUrl(rawEngagement, dsp, DSP_DELIVERY_KINDS.DISPLAY_WRAPPER),
  };
}

function buildSupplementalTrackerUrls(ctx = {}, trackerType) {
  return (ctx.pixels || [])
    .filter((row) => row.pixel_type === trackerType && trimText(row.url))
    .map((row) => trimText(row.url));
}

function resolveClickThroughUrl(ctx = {}, baseUrl = '') {
  const explicit = trimText(ctx.tag?.click_url || ctx.selectedBinding?.creative_click_url);
  if (explicit) return explicit;
  return `${trimText(baseUrl).replace(/\/+$/, '')}/v1/tags/tracker/${ctx.tag?.id}/click`;
}

function resolveSourceFallback(selectedBinding = {}, renditions = []) {
  const source = extractSourceInfo(selectedBinding, renditions);
  return {
    url: trimText(selectedBinding?.public_url || renditions.find((row) => row.is_source)?.public_url || ''),
    width: source.width,
    height: source.height,
    mimeType: source.mimeType || 'video/mp4',
    durationMs: source.durationMs,
    codec: trimText(renditions.find((row) => row.is_source)?.codec || ''),
    bitrateKbps: Number(renditions.find((row) => row.is_source)?.bitrate_kbps || 0) || null,
  };
}

function buildLiveXmlForTagContext(ctx, { profile = 'default', baseUrl }) {
  const normalizedProfile = normalizeProfile(profile, 'default');
  const configuredVersion = trimText(ctx.tag.vast_version);
  const campaignDsp = readCampaignDsp(ctx.tag.campaign_metadata);
  const xmlVersion = getProfileVersion(normalizedProfile, configuredVersion);
  const liveBaseUrl = trimText(baseUrl).replace(/\/+$/, '');
  const trackers = buildTrackerUrls({ baseUrl: liveBaseUrl, tagId: ctx.tag.id, dsp: '' });
  const impressionUrls = [trackers.impression, ...buildSupplementalTrackerUrls(ctx, 'impression')];
  const clickTrackingUrls = [trackers.click, ...buildSupplementalTrackerUrls(ctx, 'click')];
  const clickThroughUrl = resolveClickThroughUrl(ctx, liveBaseUrl);
  const adTitle = `${trimText(ctx.tag.name) || 'SMX Studio Tag'} · ${normalizedProfile.toUpperCase()}`;
  const source = resolveSourceFallback(ctx.selectedBinding || {}, ctx.renditions || []);
  const trackingEvents = buildTrackingEventUrls(trackers.engagement);
  const errorUrl = `${trackers.engagement}?event=error`;

  if (ctx.tag.vast_wrapper && trimText(ctx.tag.vast_url)) {
    return buildWrapperXml({
      tagId: ctx.tag.id,
      targetUrl: trimText(ctx.tag.vast_url),
      impressionUrls,
      errorUrl,
      clickTrackingUrls,
      clickThroughUrl,
      xmlVersion,
      adTitle,
    });
  }

  if (ctx.selectedBinding?.source_kind === 'vast_wrapper' && trimText(ctx.selectedBinding.public_url)) {
    return buildWrapperXml({
      tagId: ctx.tag.id,
      targetUrl: trimText(ctx.selectedBinding.public_url),
      impressionUrls,
      errorUrl,
      clickTrackingUrls,
      clickThroughUrl,
      xmlVersion,
      adTitle,
    });
  }

  const mediaFiles = buildRenditionPlan(ctx.selectedBinding || {}, ctx.renditions);

  return buildInlineXml({
    tagId: ctx.tag.id,
    adTitle,
    xmlVersion,
    impressionUrls,
    errorUrl,
    clickTrackingUrls,
    clickThroughUrl,
    durationMs: ctx.selectedBinding?.duration_ms ?? source.durationMs ?? 30000,
    mediaFiles,
    source,
    trackingEvents,
  });
}

async function upsertFormatMetadata(pool, tagId, nextMetadata) {
  await pool.query(
    `INSERT INTO tag_format_configs (tag_id, metadata)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (tag_id) DO UPDATE
     SET metadata = $2::jsonb,
         updated_at = NOW()`,
    [tagId, JSON.stringify(nextMetadata)],
  );
}

function buildStaticHistoryEntry(manifest, profiles) {
  return {
    generatedAt: manifest.generatedAt,
    trigger: manifest.trigger,
    profileCount: manifest.profileCount,
    profiles: profiles.map((profile) => ({
      profile: profile.profile,
      dsp: profile.dsp,
      xmlVersion: profile.xmlVersion,
    })),
  };
}

export async function publishStaticVastProfiles(pool, { tagId, baseUrl, profiles = ['default', 'basis', 'illumin'], trigger = 'manual_publish' }) {
  const ctx = await getTagContext(pool, tagId);
  if (!ctx) throw new Error('Tag not found.');
  if (String(ctx.tag.format || '').toLowerCase() !== 'vast') throw new Error('Static VAST publish is only available for VAST tags.');

  const currentState = parseStaticDeliveryMetadata(ctx.tag.format_metadata);
  const generatedAt = new Date().toISOString();
  const normalizedProfiles = Array.from(new Set((profiles || []).map((profile) => normalizeStaticProfile(profile)).filter(Boolean)));
  const snapshots = { ...currentState.snapshots };
  const staticProfiles = { ...currentState.staticProfiles };
  const staticProfileStatus = { ...currentState.staticProfileStatus };
  const publishedProfiles = [];

  for (const profile of normalizedProfiles) {
    const xml = buildLiveXmlForTagContext(ctx, { profile, baseUrl });
    const publicUrl = buildStaticProfileUrl(baseUrl, tagId, profile);
    const contentLength = Buffer.byteLength(xml, 'utf8');
    const snapshot = {
      xml,
      publicUrl,
      generatedAt,
      trigger,
      xmlVersion: getProfileVersion(profile, ctx.tag.vast_version),
      dsp: deriveProfileDsp(profile, readCampaignDsp(ctx.tag.campaign_metadata)) || null,
      contentLength,
      contentType: 'application/xml; charset=utf-8',
      etag: hashEtag(xml),
    };
    snapshots[profile] = snapshot;
    staticProfiles[profile] = publicUrl;
    staticProfileStatus[profile] = {
      publicUrl,
      storageKey: null,
      available: true,
      lastPublishedAt: generatedAt,
      contentLength,
      contentType: snapshot.contentType,
      etag: snapshot.etag,
    };
    publishedProfiles.push({
      profile,
      dsp: snapshot.dsp,
      xmlVersion: snapshot.xmlVersion,
    });
  }

  const previousManifest = currentState.manifest;
  const history = [
    buildStaticHistoryEntry({
      generatedAt,
      trigger,
      profileCount: publishedProfiles.length,
    }, publishedProfiles),
    ...(Array.isArray(previousManifest?.history) ? previousManifest.history : []),
  ].slice(0, 10);

  const manifest = {
    publicUrl: buildStaticProfileUrl(baseUrl, tagId, 'default'),
    generatedAt,
    trigger,
    previousGeneratedAt: previousManifest?.generatedAt ?? null,
    previousTrigger: previousManifest?.trigger ?? null,
    profileCount: publishedProfiles.length,
    history,
  };

  const jobTimestamp = new Date().toISOString();
  const nextState = {
    snapshots,
    staticProfiles,
    staticProfileStatus,
    manifest,
    job: {
      id: randomUUID(),
      status: 'completed',
      priority: 0,
      attempts: 1,
      maxAttempts: 1,
      trigger,
      createdAt: jobTimestamp,
      updatedAt: jobTimestamp,
      runAt: jobTimestamp,
      startedAt: jobTimestamp,
      completedAt: jobTimestamp,
      failedAt: null,
      error: null,
    },
  };

  await upsertFormatMetadata(pool, tagId, buildStaticDeliveryMetadata(ctx.tag.format_metadata, nextState));
  return nextState;
}

export async function queueStaticVastPublish(pool, { tagId, baseUrl, trigger = 'manual_queue' }) {
  return publishStaticVastProfiles(pool, {
    tagId,
    baseUrl,
    profiles: ['default', 'basis', 'illumin'],
    trigger,
  });
}

export async function getStaticVastXml(pool, { tagId, profile = 'default', baseUrl }) {
  const ctx = await getTagContext(pool, tagId);
  if (!ctx) return null;
  const currentState = parseStaticDeliveryMetadata(ctx.tag.format_metadata);
  const normalizedProfile = normalizeStaticProfile(profile);
  const snapshot = currentState.snapshots?.[normalizedProfile];
  if (snapshot?.xml) {
    return {
      xml: snapshot.xml,
      contentType: snapshot.contentType || 'application/xml; charset=utf-8',
      etag: snapshot.etag || null,
    };
  }
  const xml = buildLiveXmlForTagContext(ctx, { profile: normalizedProfile, baseUrl });
  return { xml, contentType: 'application/xml; charset=utf-8', etag: hashEtag(xml) };
}

export async function getLiveVastXml(pool, { tagId, profile = 'default', baseUrl }) {
  const ctx = await getTagContext(pool, tagId);
  if (!ctx) return null;
  return buildLiveXmlForTagContext(ctx, { profile, baseUrl });
}

export async function getTagClickDestination(pool, tagId) {
  const ctx = await getTagContext(pool, tagId);
  if (!ctx) return null;
  return trimText(ctx.tag.click_url || ctx.selectedBinding?.creative_click_url) || null;
}

export async function getVastDeliveryDiagnostics(pool, { tagId, baseUrl }) {
  const ctx = await getTagContext(pool, tagId);
  if (!ctx) return null;

  const selectedCampaignDsp = readCampaignDsp(ctx.tag.campaign_metadata);
  const deliveryMode = String(ctx.tag.format || '').toLowerCase() === 'vast' && shouldUseDspVideoDelivery(selectedCampaignDsp)
    ? 'dsp_video_contract'
    : 'smx_standard';
  const currentState = parseStaticDeliveryMetadata(ctx.tag.format_metadata);
  const liveProfiles = {
    default: buildLiveProfileUrl(baseUrl, ctx.tag.id, 'default'),
    basis: buildLiveProfileUrl(baseUrl, ctx.tag.id, 'basis'),
    illumin: buildLiveProfileUrl(baseUrl, ctx.tag.id, 'illumin'),
    vast4: buildLiveProfileUrl(baseUrl, ctx.tag.id, 'vast4'),
  };
  const vastPolicy = getDspDeliveryPolicy(selectedCampaignDsp, DSP_DELIVERY_KINDS.VIDEO);
  const displayPolicy = getDspDeliveryPolicy(selectedCampaignDsp, DSP_DELIVERY_KINDS.DISPLAY_WRAPPER);
  const clickPolicy = getDspDeliveryPolicy(selectedCampaignDsp, DSP_DELIVERY_KINDS.TRACKER_CLICK);
  const impressionPolicy = getDspDeliveryPolicy(selectedCampaignDsp, DSP_DELIVERY_KINDS.TRACKER_IMPRESSION);
  const trackers = buildTrackerUrls({ baseUrl, tagId, dsp: selectedCampaignDsp });

  return {
    dsp: {
      selected: selectedCampaignDsp || null,
    },
    deliverySummary: {
      basisNativeActive: false,
      deliveryMode,
      clickChain: trackers.click,
      previewStatus: deliveryMode === 'dsp_video_contract' ? 'dsp_video_contract_ready' : 'smx_standard_ready',
      previewNotes: currentState.manifest?.generatedAt
        ? `Static VAST last published ${currentState.manifest.generatedAt}.`
        : 'Using live VAST endpoints.',
    },
    deliveryDiagnostics: {
      displayWrapper: {
        policy: displayPolicy,
        selectedProfile: 'display',
        url: `${trimText(baseUrl).replace(/\/+$/, '')}/v1/tags/display/${ctx.tag.id}.js`,
      },
      vast: {
        policy: vastPolicy,
        selectedProfile: deriveProfileDsp('default', selectedCampaignDsp) || 'default',
        url: liveProfiles.default,
        liveProfiles,
        staticProfiles: Object.keys(currentState.staticProfiles || {}).length ? currentState.staticProfiles : null,
        staticProfileStatus: Object.keys(currentState.staticProfileStatus || {}).length ? currentState.staticProfileStatus : null,
        staticManifest: currentState.manifest,
        staticJob: currentState.job,
      },
      trackerClick: {
        policy: clickPolicy,
        selectedProfile: 'click',
        url: trackers.click,
      },
      trackerImpression: {
        policy: impressionPolicy,
        selectedProfile: 'impression',
        url: trackers.impression,
      },
    },
  };
}

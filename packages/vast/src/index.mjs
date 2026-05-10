/**
 * @smx/vast — VAST 4.0 XML tag generator
 *
 * Usage:
 *   import { buildVastTag } from '@smx/vast';
 *   const xml = buildVastTag({ tagId, adTitle, mediaUrl, clickUrl, impressionUrl, ... });
 */

/**
 * Escape a string for safe inclusion in XML.
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a VAST 4.0 XML document for a linear video ad.
 *
 * @param {object} opts
 * @param {string}   opts.tagId          - Ad tag UUID
 * @param {string}   opts.adTitle        - Human-readable ad title
 * @param {string}   opts.mediaUrl       - MP4 (or HLS master) URL
 * @param {string}   opts.clickUrl       - Click-through URL
 * @param {string}   opts.impressionUrl  - Impression tracking URL
 * @param {string[]} [opts.trackingUrls] - Additional event tracking URLs (start, firstQuartile, …)
 * @param {number}   [opts.duration]     - Ad duration in seconds (default 30)
 * @param {number}   [opts.width]        - Media width px (default 1920)
 * @param {number}   [opts.height]       - Media height px (default 1080)
 * @param {string}   [opts.bitrate]      - Bitrate hint, e.g. "2000" kbps
 * @param {string}   [opts.mimeType]     - MIME type (default video/mp4)
 * @returns {string} VAST 4.0 XML string
 */
export function buildVastTag({
  tagId,
  adTitle,
  mediaUrl,
  clickUrl,
  impressionUrl,
  trackingUrls = [],
  duration = 30,
  width = 1920,
  height = 1080,
  bitrate = '',
  mimeType = 'video/mp4',
}) {
  const durationFmt = formatDuration(duration);

  const trackingEvents = trackingUrls.map(({ event, url }) =>
    `          <Tracking event="${esc(event)}"><![CDATA[${url}]]></Tracking>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0" xmlns="http://www.iab.com/VAST">
  <Ad id="${esc(tagId)}">
    <InLine>
      <AdSystem version="1.0">SMX Studio</AdSystem>
      <AdTitle>${esc(adTitle)}</AdTitle>
      <Impression id="smx-imp"><![CDATA[${impressionUrl}]]></Impression>
      <Creatives>
        <Creative id="${esc(tagId)}-creative" sequence="1">
          <Linear>
            <Duration>${durationFmt}</Duration>
            <TrackingEvents>
${trackingEvents}
            </TrackingEvents>
            <VideoClicks>
              <ClickThrough><![CDATA[${clickUrl}]]></ClickThrough>
            </VideoClicks>
            <MediaFiles>
              <MediaFile
                delivery="progressive"
                type="${esc(mimeType)}"
                width="${width}"
                height="${height}"${bitrate ? `\n                bitrate="${esc(bitrate)}"` : ''}
              ><![CDATA[${mediaUrl}]]></MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
}

/**
 * Build a VAST wrapper that points at an upstream tag URL.
 *
 * @param {object} opts
 * @param {string} opts.tagId
 * @param {string} opts.adTitle
 * @param {string} opts.wrapperUrl      - Upstream VAST tag URL
 * @param {string} [opts.impressionUrl] - Optional impression tracker
 * @returns {string}
 */
export function buildVastWrapper({ tagId, adTitle, wrapperUrl, impressionUrl = '' }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0" xmlns="http://www.iab.com/VAST">
  <Ad id="${esc(tagId)}">
    <Wrapper followAdditionalWrappers="true" allowMultipleAds="true" fallbackOnNoAd="true">
      <AdSystem version="1.0">SMX Studio</AdSystem>
      <AdTitle>${esc(adTitle)}</AdTitle>
      <VASTAdTagURI><![CDATA[${wrapperUrl}]]></VASTAdTagURI>
      ${impressionUrl ? `<Impression><![CDATA[${impressionUrl}]]></Impression>` : ''}
    </Wrapper>
  </Ad>
</VAST>`;
}

/**
 * Format integer seconds as HH:MM:SS.mmm
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}.000`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

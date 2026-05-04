import type { VastSimidAdapterResult } from './vast-simid';

export function buildVastSimidXml(
  adapter: VastSimidAdapterResult,
  creativeFileUrl = '{CREATIVE_URL}',
  adTitle = 'SMX Interactive Ad',
): string {
  const duration = formatVastDuration(adapter.simid.durationSeconds);
  const skipOffset = adapter.simid.skipOffset > 0
    ? ` skipoffset="${formatVastDuration(adapter.simid.skipOffset)}"`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="vast.xsd">
  <Ad id="${escapeXml(adapter.portableProject.documentId)}" sequence="1">
    <InLine>
      <AdSystem version="1.0">SMX Studio</AdSystem>
      <AdTitle>${escapeXml(adTitle)}</AdTitle>
      <Impression id="smx-impression"><![CDATA[]]></Impression>
      <Creatives>
        <Creative id="smx-creative-1" sequence="1">
          <Linear${skipOffset}>
            <Duration>${duration}</Duration>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" width="${adapter.portableProject.canvas.width}" height="${adapter.portableProject.canvas.height}"><![CDATA[]]></MediaFile>
              <InteractiveCreativeFile type="${adapter.simid.interactiveCreativeType}" apiFramework="SIMID" variableDuration="true"><![CDATA[${creativeFileUrl}]]></InteractiveCreativeFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
}

function formatVastDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

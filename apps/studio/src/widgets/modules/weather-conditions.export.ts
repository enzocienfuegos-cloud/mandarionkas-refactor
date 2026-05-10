import type { WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';
import { resolveWeatherIcon } from './weather-conditions.shared';

export function renderWeatherConditionsExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.sky);
  const condition = String(node.props.condition ?? 'Cloudy');
  const temperature = Number(node.props.temperature ?? 24);
  const location = String(node.props.location ?? 'San Salvador');
  const latitude = Number(node.props.latitude ?? 13.6929);
  const longitude = Number(node.props.longitude ?? -89.2182);
  const provider = String(node.props.provider ?? 'open-meteo');
  const fetchPolicy = String(node.props.fetchPolicy ?? 'cache-first');
  const cacheTtlMs = Math.max(1000, Number(node.props.cacheTtlMs ?? 300000));
  const liveWeather = Boolean(node.props.liveWeather ?? true);
  const icon = resolveWeatherIcon(condition, true);
  const base = [
    `position:absolute`,`left:${frame.x}px`,`top:${frame.y}px`,`width:${frame.width}px`,`height:${frame.height}px`,`transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,`overflow:hidden`,`box-sizing:border-box`,`border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? exportPalette.slate50)}`,`color:${String(style.color ?? exportPalette.slate)}`,`display:flex`,`flex-direction:column`,
  ].join(';');
  return `<div class="widget widget-weather-conditions" data-widget-id="${node.id}" data-weather-location="${escapeHtml(location)}" data-weather-temperature="${temperature}" data-weather-condition="${escapeHtml(condition)}" data-weather-latitude="${latitude}" data-weather-longitude="${longitude}" data-weather-provider="${escapeHtml(provider)}" data-weather-fetch-policy="${escapeHtml(fetchPolicy)}" data-weather-cache-ttl="${cacheTtlMs}" data-weather-live="${String(liveWeather)}" style="${base}"><div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div><div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;"><div><div data-weather-temperature-display style="font-size:28px;font-weight:900;">${temperature}°</div><div data-weather-location-display style="font-size:12px;opacity:.78;">${escapeHtml(location)}</div></div><div data-weather-icon style="font-size:34px;">${icon}</div></div><div style="padding:8px 10px;border-radius:10px;background:${escapeHtml(accent)}22;font-size:12px;display:flex;justify-content:space-between;gap:8px;"><span data-weather-condition-display>${escapeHtml(condition)}</span><span data-weather-status style="opacity:.74;">${liveWeather && provider === 'open-meteo' ? 'Fetching live weather' : 'Static preview'}</span></div></div></div>`;
}

export const weatherConditionsExportRenderer: ExportRendererManifestEntry = {
  type: 'weather-conditions',
  render: ({ node }) => renderWeatherConditionsExport(node as unknown as WidgetNode),
};

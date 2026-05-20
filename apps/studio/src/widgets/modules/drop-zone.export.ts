import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

export function renderDropZoneExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const accentColor = escapeHtml(String(style.accentColor ?? '#00e5ff'));

  // Expand the hit area by hitPadding on all sides
  const left = frame.x - hitPadding;
  const top = frame.y - hitPadding;
  const width = frame.width + hitPadding * 2;
  const height = frame.height + hitPadding * 2;

  const shellStyle = [
    'position:absolute',
    `left:${left}px`,
    `top:${top}px`,
    `width:${width}px`,
    `height:${height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    'background:transparent',
    'border:none',
    'outline:none',
    'pointer-events:auto',
    'box-sizing:border-box',
    `border-radius:50%`,
  ].join(';');

  // Highlight overlay — shown by runtime when a token hovers over the zone
  const highlightStyle = [
    'position:absolute',
    'inset:0',
    `border-radius:50%`,
    `background:${accentColor}33`,
    `border:2px solid ${accentColor}`,
    'opacity:0',
    'transition:opacity 0.15s ease',
    'pointer-events:none',
    'box-sizing:border-box',
  ].join(';');

  return `<div
    class="widget widget-drop-zone smx-drop-zone"
    data-widget-id="${escapeHtml(node.id)}"
    data-smx-action="drop-zone"
    data-drop-zone-id="${escapeHtml(node.id)}"
    style="${shellStyle}"
  ><div class="smx-drop-zone-highlight" style="${highlightStyle}"></div></div>`;
}

export const dropZoneExportRenderer: ExportRendererManifestEntry = {
  type: 'drop-zone',
  render: ({ node }) => renderDropZoneExport(node as unknown as WidgetNode),
};

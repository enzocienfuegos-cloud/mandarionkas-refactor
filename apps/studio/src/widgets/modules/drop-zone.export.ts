import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

export function renderDropZoneExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const width = Math.max(20, Number(frame.width ?? node.props.width ?? 120));
  const height = Math.max(20, Number(frame.height ?? node.props.height ?? 120));
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const accentColor = String(style.accentColor ?? '#00e5ff');
  const zoneWidthPx = width + hitPadding * 2;
  const zoneHeightPx = height + hitPadding * 2;

  // Position at frame center accounting for hit padding expansion
  const left = frame.x - hitPadding;
  const top = frame.y - hitPadding;

  const shellStyle = [
    `position:absolute`,
    `left:${left}px`,
    `top:${top}px`,
    `width:${zoneWidthPx}px`,
    `height:${zoneHeightPx}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `box-sizing:border-box`,
    `border-radius:50%`,
    `background:transparent`,
    `pointer-events:none`,
    // Highlight ring — shown by the drag runtime via data-drop-zone-active
    `transition:box-shadow 0.12s ease-out`,
  ].join(';');

  // Highlight overlay (activated by runtime when a compatible token is dragged over)
  const highlightStyle = [
    `position:absolute`,
    `inset:0`,
    `border-radius:inherit`,
    `pointer-events:none`,
    `opacity:0`,
    `background:${accentColor}1a`,
    `border:2px dashed ${accentColor}`,
    `transition:opacity 0.12s ease-out`,
    `box-sizing:border-box`,
  ].join(';');

  return `<div
    class="widget widget-drop-zone"
    data-widget-id="${escapeHtml(node.id)}"
    data-smx-action="drop-zone"
    data-drop-zone-id="${escapeHtml(node.id)}"
    data-zone-width="${width}"
    data-zone-height="${height}"
    data-zone-hit-padding="${hitPadding}"
    style="${shellStyle}"
  ><div class="smx-drop-zone-highlight" style="${highlightStyle}"></div></div>`;
}

export const dropZoneExportRenderer: ExportRendererManifestEntry = {
  type: 'drop-zone',
  render: ({ node }) => renderDropZoneExport(node as unknown as WidgetNode),
};

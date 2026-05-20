import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

export function renderStepIndicatorExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const total = Math.max(1, Math.min(12, Number(node.props.total ?? 3)));
  const current = Math.max(1, Math.min(total, Number(node.props.current ?? 1)));
  const size = Math.max(4, Number(node.props.size ?? 10));
  const gap = Math.max(2, Number(node.props.gap ?? 10));
  const doneColor = escapeHtml(String(node.props.doneColor ?? style.accentColor ?? '#ffffff'));
  const pendingColor = escapeHtml(String(node.props.pendingColor ?? 'rgba(255,255,255,0.3)'));

  const shellStyle = [
    'position:absolute',
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    `gap:${gap}px`,
    'pointer-events:none',
    'box-sizing:border-box',
  ].join(';');

  const dots = Array.from({ length: total }, (_, i) => {
    const done = i < current;
    const dotStyle = [
      `width:${size}px`,
      `height:${size}px`,
      `border-radius:50%`,
      `background:${done ? doneColor : pendingColor}`,
      `flex-shrink:0`,
      `box-sizing:border-box`,
    ].join(';');
    return `<span style="${dotStyle}"></span>`;
  }).join('');

  return `<div class="widget widget-step-indicator" data-widget-id="${escapeHtml(node.id)}" style="${shellStyle}">${dots}</div>`;
}

export const stepIndicatorExportRenderer: ExportRendererManifestEntry = {
  type: 'step-indicator',
  render: ({ node }) => renderStepIndicatorExport(node as unknown as WidgetNode),
};

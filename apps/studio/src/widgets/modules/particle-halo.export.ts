import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

/**
 * Particle halo — animated effect widget.
 * In static HTML export we render a subtle radial glow at the drop-zone
 * centre so there is visual polish without the live canvas.
 * pointer-events:none so it never blocks interaction.
 */
export function renderParticleHaloExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const colorB = escapeHtml(String(node.props.colorB ?? style.accentColor ?? '#00c9ff'));

  const shellStyle = [
    'position:absolute',
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 0.55)}`,
    'pointer-events:none',
    'box-sizing:border-box',
    `border-radius:50%`,
    `background:radial-gradient(circle at 50% 50%, ${colorB}22 0%, transparent 70%)`,
  ].join(';');

  return `<div class="widget widget-particle-halo" data-widget-id="${escapeHtml(node.id)}" style="${shellStyle}"></div>`;
}

export const particleHaloExportRenderer: ExportRendererManifestEntry = {
  type: 'particle-halo',
  render: ({ node }) => renderParticleHaloExport(node as unknown as WidgetNode),
};

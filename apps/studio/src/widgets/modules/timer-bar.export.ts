import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml } from '../registry/export-helpers';
import type { ExportRendererManifestEntry } from './export-registry';

/**
 * Timer bar — renders as a CSS-animated countdown that depletes over
 * the scene's durationMs. pointer-events:none so it never blocks interaction.
 */
export function renderTimerBarExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const durationMs = Math.max(500, Number(node.props.durationMs ?? 7000));
  const orientation = String(node.props.orientation ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
  const fillColor = escapeHtml(String(node.props.fillColor ?? style.accentColor ?? '#00e5ff'));
  const trackColor = escapeHtml(String(node.props.trackColor ?? 'rgba(255,255,255,0.2)'));
  const borderRadius = Math.max(0, Number(node.props.borderRadius ?? 4));
  const thickness = Math.max(2, Number(node.props.thickness ?? 8));

  const isHorizontal = orientation === 'horizontal';
  const trackW = isHorizontal ? frame.width : thickness;
  const trackH = isHorizontal ? thickness : frame.height;
  const animId = `smx-tb-${escapeHtml(node.id).replace(/[^a-z0-9]/gi, '_')}`;
  const transformOrigin = isHorizontal ? 'left center' : 'center bottom';
  const keyframes = isHorizontal
    ? `@keyframes ${animId}{from{transform:scaleX(1)}to{transform:scaleX(0)}}`
    : `@keyframes ${animId}{from{transform:scaleY(1)}to{transform:scaleY(0)}}`;

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
    'pointer-events:none',
    'box-sizing:border-box',
  ].join(';');

  const trackStyle = [
    `width:${trackW}px`,
    `height:${trackH}px`,
    `background:${trackColor}`,
    `border-radius:${borderRadius}px`,
    'overflow:hidden',
    'position:relative',
    'box-sizing:border-box',
  ].join(';');

  const fillStyle = [
    'position:absolute',
    'inset:0',
    `background:${fillColor}`,
    `border-radius:${borderRadius}px`,
    `transform-origin:${transformOrigin}`,
    `animation:${animId} ${durationMs}ms linear 1 forwards`,
  ].join(';');

  return `<style>${keyframes}</style><div class="widget widget-timer-bar" data-widget-id="${escapeHtml(node.id)}" style="${shellStyle}"><div style="${trackStyle}"><div style="${fillStyle}"></div></div></div>`;
}

export const timerBarExportRenderer: ExportRendererManifestEntry = {
  type: 'timer-bar',
  render: ({ node }) => renderTimerBarExport(node as unknown as WidgetNode),
};

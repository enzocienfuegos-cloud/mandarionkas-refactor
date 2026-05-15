import { buildResolvedWidgetsById } from '../../domain/document/canvas-variants';
import type { StudioState, WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml, renderGenericExport } from '../registry/export-helpers';
import { getWidgetDefinition } from '../registry/widget-registry';

function renderGroupScratchChildren(
  node: WidgetNode,
  state: StudioState,
  assetPathMap: Record<string, string>,
): string {
  const resolvedWidgets = buildResolvedWidgetsById(state.document);
  const children = (node.childIds ?? [])
    .map((childId) => resolvedWidgets[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .filter((child) => !child.hidden)
    .sort((left, right) => left.zIndex - right.zIndex);

  return children.map((child) => {
    const relativeChild: WidgetNode = {
      ...child,
      frame: {
        ...child.frame,
        x: child.frame.x - node.frame.x,
        y: child.frame.y - node.frame.y,
      },
    };
    const definition = getWidgetDefinition(relativeChild.type);
    if (definition.renderExport) {
      return definition.renderExport(relativeChild, state, assetPathMap);
    }
    return renderGenericExport(relativeChild, relativeChild.name, relativeChild.type);
  }).join('\n');
}

export function renderGroupExport(
  node: WidgetNode,
  state?: StudioState,
  assetPathMap: Record<string, string> = {},
): string {
  if (!node.props.scratchEnabled || !state) {
    return renderGenericExport(node, node.name, 'Group');
  }

  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.orange);
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(0, Math.min(100, Number(node.props.autoRevealThresholdPercent ?? 10)));
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const base = [
    `position:absolute`,
    `left:${node.frame.x}px`,
    `top:${node.frame.y}px`,
    `width:${node.frame.width}px`,
    `height:${node.frame.height}px`,
    `transform:rotate(${node.frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:transparent`,
    `pointer-events:auto`,
  ].join(';');

  return `<div class="widget widget-group widget-group-scratch" data-widget-id="${node.id}" style="${base}">
    <div
      class="scratch-reveal-shell"
      data-scratch-widget-id="${node.id}"
      data-scratch-radius="${scratchRadius}"
      data-scratch-auto-reveal-threshold="${autoRevealThresholdPercent}"
      data-scratch-accent="${escapeHtml(accent)}"
      data-scratch-cover-blur="${coverBlur}"
      data-scratch-reveal-animation="none"
      data-scratch-reveal-animation-duration="700"
      data-scratch-reveal-animation-delay="0"
      style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;background:transparent;"
    >
      <div
        data-scratch-mask-target
        style="position:absolute;inset:0;pointer-events:none;${coverBlur > 0 ? `filter:blur(${coverBlur}px);` : ''}"
      >
        ${renderGroupScratchChildren(node, state, assetPathMap)}
      </div>
      <canvas data-scratch-canvas style="position:absolute;inset:0;z-index:1;width:100%;height:100%;cursor:crosshair;touch-action:none;outline:none;background:transparent;-webkit-tap-highlight-color:transparent;user-select:none;"></canvas>
    </div>
  </div>`;
}

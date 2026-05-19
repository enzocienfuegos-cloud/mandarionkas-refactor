import { buildResolvedWidgetsById } from '../../domain/document/canvas-variants';
import type { StudioState, WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml, renderGenericExport } from '../registry/export-helpers';
import { getWidgetDefinition } from '../registry/widget-registry';
import { getScratchActivationDelayMs } from './group-scratch-activation';
import { readShadowFromStyle, shadowConfigToBoxShadow } from '../../shared/style/shadow';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  type ScratchMilestone,
} from './group-scratch-constants';

function renderGroupScratchChildren(
  node: WidgetNode,
  state: StudioState,
  assetPathMap: Record<string, string>,
  baseFrame: WidgetNode['frame'],
): string {
  const resolvedWidgets = buildResolvedWidgetsById(state.document);
  const renderScratchCoverLeaf = (current: WidgetNode): string => {
    const relativeFrame = {
      ...current.frame,
      x: current.frame.x - baseFrame.x,
      y: current.frame.y - baseFrame.y,
    };
    const wrapperStyle = [
      `position:absolute`,
      `left:${relativeFrame.x}px`,
      `top:${relativeFrame.y}px`,
      `width:${relativeFrame.width}px`,
      `height:${relativeFrame.height}px`,
      `z-index:${current.zIndex}`,
      `opacity:${Number(current.style.opacity ?? 1)}`,
      `transform:rotate(${relativeFrame.rotation}deg)`,
      `transform-origin:center`,
      `pointer-events:none`,
      `box-sizing:border-box`,
    ].join(';');
    const embeddedChild: WidgetNode = {
      ...current,
      frame: {
        ...current.frame,
        x: 0,
        y: 0,
        rotation: 0,
      },
      style: {
        ...current.style,
        opacity: 1,
      },
      props: current.type === 'group'
        ? {
            ...current.props,
            scratchEnabled: false,
          }
        : current.props,
    };
    const definition = getWidgetDefinition(embeddedChild.type);
    const childHtml = definition.renderExport
      ? definition.renderExport(embeddedChild, state, assetPathMap)
      : renderGenericExport(embeddedChild, embeddedChild.name, embeddedChild.type);

    return `<div
      data-scratch-cover-widget-id="${escapeHtml(current.id)}"
      data-scratch-origin-x="${baseFrame.x}"
      data-scratch-origin-y="${baseFrame.y}"
      style="${wrapperStyle}"
    ><div data-scratch-cover-motion-id="${escapeHtml(current.id)}" style="position:relative;width:100%;height:100%;">${childHtml}</div></div>`;
  };

  function renderNodeTree(current: WidgetNode, visited = new Set<string>()): string[] {
    if (visited.has(current.id) || current.hidden) return [];
    visited.add(current.id);

    if (current.type === 'group' && current.childIds?.length) {
      const childNodes = current.childIds
        .map((childId) => resolvedWidgets[childId])
        .filter((child): child is WidgetNode => Boolean(child))
        .sort((left, right) => left.zIndex - right.zIndex)
        .flatMap((child) => renderNodeTree(child, visited));
      return [renderScratchCoverLeaf(current), ...childNodes];
    }

    return [renderScratchCoverLeaf(current)];
  }

  return (node.childIds ?? [])
    .map((childId) => resolvedWidgets[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .sort((left, right) => left.zIndex - right.zIndex)
    .flatMap((child) => renderNodeTree(child))
    .join('\n');
}

function resolveScratchGroupExportFrame(node: WidgetNode, state: StudioState): WidgetNode['frame'] {
  const resolvedWidgets = buildResolvedWidgetsById(state.document);
  const baseFrame = node.frame;
  function collectFrames(current: WidgetNode, visited = new Set<string>()): WidgetNode['frame'][] {
    if (visited.has(current.id) || current.hidden) return [];
    visited.add(current.id);
    if (current.type === 'group' && current.childIds?.length) {
      return current.childIds
        .map((childId) => resolvedWidgets[childId])
        .filter((child): child is WidgetNode => Boolean(child))
        .flatMap((child) => collectFrames(child, visited));
    }
    return [current.frame];
  }

  const childFrames = (node.childIds ?? [])
    .map((childId) => resolvedWidgets[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .flatMap((child) => collectFrames(child));

  if (!childFrames.length) return baseFrame;

  const minX = Math.min(baseFrame.x, ...childFrames.map((frame) => frame.x));
  const minY = Math.min(baseFrame.y, ...childFrames.map((frame) => frame.y));
  const maxX = Math.max(baseFrame.x + baseFrame.width, ...childFrames.map((frame) => frame.x + frame.width));
  const maxY = Math.max(baseFrame.y + baseFrame.height, ...childFrames.map((frame) => frame.y + frame.height));

  return {
    ...baseFrame,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function renderGroupExport(
  node: WidgetNode,
  state?: StudioState,
  assetPathMap: Record<string, string> = {},
): string {
  const boxShadow = escapeHtml(shadowConfigToBoxShadow(readShadowFromStyle(node.style)));
  if (!node.props.scratchEnabled || !state) {
    return renderGenericExport(node, node.name, 'Group').replace('">', `;box-shadow:${boxShadow}">`);
  }

  const style = node.style ?? {};
  const accent = String(style.accentColor ?? exportPalette.orange);
  const frame = resolveScratchGroupExportFrame(node, state);
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(
    0,
    Math.min(100, Number(node.props.autoRevealThresholdPercent ?? DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD)),
  );
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const scratchActivationDelayMs = getScratchActivationDelayMs(node, buildResolvedWidgetsById(state.document));
  const milestones: ScratchMilestone[] = Array.isArray(node.props.scratchMilestones)
    ? (node.props.scratchMilestones as ScratchMilestone[])
    : [];
  const sortedMilestones = [...milestones].sort((left, right) => left.thresholdPercent - right.thresholdPercent);
  const milestonesJson = escapeHtml(JSON.stringify(sortedMilestones));
  const revealTargetMode = escapeHtml(String(node.props.revealTargetMode ?? 'auto'));
  const revealTargetId = escapeHtml(String(node.props.revealTargetId ?? ''));
  const replayTargetMotionOnReveal = node.props.replayTargetMotionOnReveal !== false;
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:transparent`,
    `box-shadow:${boxShadow}`,
    `pointer-events:auto`,
  ].join(';');

  return `<div class="widget widget-group widget-group-scratch" data-widget-id="${node.id}" style="${base}">
    <div
      class="scratch-reveal-shell"
      data-scratch-shell
      data-scratch-widget-id="${node.id}"
      data-scratch-radius="${scratchRadius}"
      data-scratch-auto-reveal-threshold="${autoRevealThresholdPercent}"
      data-scratch-milestones="${milestonesJson}"
      data-scratch-reveal-target-mode="${revealTargetMode}"
      data-scratch-reveal-target-id="${revealTargetId}"
      data-scratch-replay-target-motion-on-reveal="${replayTargetMotionOnReveal ? 'true' : 'false'}"
      data-scratch-accent="${escapeHtml(accent)}"
      data-scratch-cover-blur="${coverBlur}"
      data-scratch-activation-delay="${scratchActivationDelayMs}"
      data-scratch-reveal-animation="none"
      data-scratch-reveal-animation-duration="700"
      data-scratch-reveal-animation-delay="0"
      style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;background:transparent;"
    >
      <div
        data-scratch-mask-target
        style="position:absolute;inset:0;pointer-events:none;${coverBlur > 0 ? `filter:blur(${coverBlur}px);` : ''}"
      >
        ${renderGroupScratchChildren(node, state, assetPathMap, frame)}
      </div>
      <canvas data-scratch-canvas style="position:absolute;inset:0;z-index:1;width:100%;height:100%;cursor:crosshair;touch-action:none;outline:none;background:transparent;-webkit-tap-highlight-color:transparent;user-select:none;"></canvas>
    </div>
  </div>`;
}

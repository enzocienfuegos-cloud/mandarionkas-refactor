import type { StudioState, WidgetNode } from '../../domain/document/types';
import { exportTokens as exportPalette } from '../../export/export-tokens';
import { escapeHtml, renderGenericExport } from '../registry/export-helpers';
import { getScratchActivationDelayMs } from './group-scratch-activation';
import { readShadowFromStyle, shadowConfigToBoxShadow } from '../../shared/style/shadow';
import { isPlainWhite, isTransparentPaint } from '../../shared/style/paint-utils';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  type ScratchMilestone,
} from './group-scratch-constants';
import { buildResolvedWidgetsById } from '../../domain/document/canvas-variants';

function resolveScratchCoverColor(node: WidgetNode): string {
  const explicitCoverColor = String(node.props.scratchCoverColor ?? '').trim();
  if (!isTransparentPaint(explicitCoverColor)) return explicitCoverColor;

  const background = String(node.style.backgroundColor ?? '').trim();
  if (!isTransparentPaint(background)) return background;

  const accent = String(node.style.accentColor ?? exportPalette.orange).trim();
  if (!isTransparentPaint(accent) && !isPlainWhite(accent)) return accent;

  return 'rgba(245, 158, 11, 0.94)';
}

export function renderGroupExport(
  node: WidgetNode,
  state?: StudioState,
  _assetPathMap: Record<string, string> = {},
): string {
  const boxShadow = escapeHtml(shadowConfigToBoxShadow(readShadowFromStyle(node.style)));
  if (!node.props.scratchEnabled || !state) {
    return renderGenericExport(node, node.name, 'Group').replace('">', `;box-shadow:${boxShadow}">`);
  }

  const style = node.style ?? {};
  const frame = node.frame;
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(
    0,
    Math.min(100, Number(node.props.autoRevealThresholdPercent ?? DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD)),
  );
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const coverColor = resolveScratchCoverColor(node);
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
      data-scratch
      data-scratch-widget-id="${node.id}"
      data-scratch-radius="${scratchRadius}"
      data-scratch-auto-reveal-threshold="${autoRevealThresholdPercent}"
      data-scratch-milestones="${milestonesJson}"
      data-scratch-reveal-target-mode="${revealTargetMode}"
      data-scratch-reveal-target-id="${revealTargetId}"
      data-scratch-replay-target-motion-on-reveal="${replayTargetMotionOnReveal ? 'true' : 'false'}"
      data-scratch-cover-blur="${coverBlur}"
      data-scratch-activation-delay="${scratchActivationDelayMs}"
      data-scratch-reveal-animation="none"
      data-scratch-reveal-animation-duration="700"
      data-scratch-reveal-animation-delay="0"
      style="position:absolute;inset:0;border-radius:inherit;overflow:hidden;background:transparent;"
    >
      <div
        data-scratch-reveal
        aria-hidden="true"
        style="position:absolute;inset:0;z-index:1;pointer-events:none;"
      ></div>
      <div
        data-scratch-cover
        data-scratch-cover-color="${escapeHtml(coverColor)}"
        style="position:absolute;inset:0;z-index:2;pointer-events:none;"
      >
        <canvas
          data-scratch-canvas
          aria-hidden="true"
          style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;background:transparent;-webkit-tap-highlight-color:transparent;user-select:none;"
        ></canvas>
      </div>
      <div
        data-scratch-hit-area
        data-scratch-completed="false"
        style="position:absolute;inset:0;z-index:3;cursor:crosshair;touch-action:none;outline:none;background:transparent;-webkit-tap-highlight-color:transparent;user-select:none;"
      ></div>
    </div>
  </div>`;
}

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../domain/document/timeline';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetColor, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { useLatestRef } from '../../shared/hooks';
import { readShadowFromStyle, shadowConfigToBoxShadow } from '../../shared/style/shadow';
import { drawRoundedRect, isTransparentPaint } from '../../shared/style/paint-utils';
import { resolveScratchCoverColor } from '../../shared/style/scratch-cover';
import { ScratchSurface } from './ScratchSurface';
import { isScratchGroupActive } from './group-scratch-activation';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  DEFAULT_SCRATCH_MILESTONES,
  type ScratchMilestone,
} from './group-scratch-constants';
import { resolveScratchInternalTargetIds } from './group-reveal-target';

const groupBaseStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
};

const scratchShellStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const scratchEditorOverlayStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  border: '1px dashed rgba(249, 115, 22, 0.8)',
  borderRadius: 18,
  background: 'transparent',
  pointerEvents: 'none',
};

function renderDefaultGroup(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const boxShadow = shadowConfigToBoxShadow(readShadowFromStyle(node.style));
  if (node.childIds?.length) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: Number(node.style.borderRadius ?? 18),
          background: resolveWidgetBackground(node, 'transparent', ctx),
          opacity: resolveWidgetOpacity(node, ctx),
          boxShadow,
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...groupBaseStyle,
        border: `1px dashed ${resolveWidgetBorder(node, ctx)}`,
        background: resolveWidgetBackground(node, 'rgba(139,92,246,0.08)', ctx),
        color: resolveWidgetColor(node, ctx),
        opacity: resolveWidgetOpacity(node, ctx),
        boxShadow,
      }}
    >
      {String(node.props.title ?? node.name)}
    </div>
  );
}

function resolveScratchCoverColorForNode(node: WidgetNode, ctx: RenderContext): string {
  return resolveScratchCoverColor({
    explicitCoverColor: String(node.props.scratchCoverColor ?? '').trim(),
    backgroundColor: resolveWidgetBackground(node, 'transparent', ctx),
    accentColor: String(node.style.accentColor ?? '').trim(),
  });
}

function drawCoverBackground(ctx: CanvasRenderingContext2D, node: WidgetNode, renderCtx: RenderContext): boolean {
  const frame = node.frame;
  const background = resolveWidgetBackground(node, 'transparent', renderCtx);
  if (isTransparentPaint(background)) return false;
  ctx.fillStyle = background;
  drawRoundedRect(ctx, frame.width, frame.height, Number(node.style.borderRadius ?? 0));
  ctx.fill();
  return true;
}

function drawCoverText(
  ctx: CanvasRenderingContext2D,
  text: string,
  node: WidgetNode,
  renderCtx: RenderContext,
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const fontSize = Math.max(6, Number(node.style.fontSize ?? (node.type === 'cta' ? 16 : 20)));
  const fontWeight = String(node.style.fontWeight ?? (node.type === 'cta' ? 800 : 700));
  const fontFamily = String(node.style.fontFamily ?? 'Inter, Arial, sans-serif');
  const lineHeight = Math.max(fontSize * 1.05, Number(node.style.lineHeight ?? fontSize * 1.18));
  const padding = Math.max(6, Math.min(18, Number(node.style.padding ?? 10)));
  const maxWidth = Math.max(1, node.frame.width - padding * 2);
  const maxHeight = Math.max(1, node.frame.height - padding * 2);
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = resolveWidgetColor(node, renderCtx);
  ctx.textAlign = String(node.style.textAlign ?? 'center') as CanvasTextAlign;
  ctx.textBaseline = 'middle';

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    const measuredWidth = typeof ctx.measureText === 'function'
      ? ctx.measureText(nextLine).width
      : nextLine.length * fontSize * 0.55;
    if (measuredWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }
    currentLine = nextLine;
  });
  if (currentLine) lines.push(currentLine);

  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const visibleLines = lines.slice(0, maxLines);
  const totalHeight = (visibleLines.length - 1) * lineHeight;
  const x = ctx.textAlign === 'left'
    ? padding
    : ctx.textAlign === 'right'
      ? node.frame.width - padding
      : node.frame.width / 2;
  const yStart = node.frame.height / 2 - totalHeight / 2;
  visibleLines.forEach((line, index) => {
    ctx.fillText?.(line, x, yStart + index * lineHeight, maxWidth);
  });
  return true;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  src: string,
  width: number,
  height: number,
  coverBlur: number,
  shouldPaint: () => boolean,
): boolean {
  const url = src.trim();
  if (!url || typeof Image === 'undefined') return false;
  const image = new Image();
  const transform = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (!shouldPaint()) return;
    ctx.save();
    if (transform && typeof ctx.setTransform === 'function') {
      ctx.setTransform(transform);
    }
    ctx.filter = coverBlur > 0 ? `blur(${Math.max(0, coverBlur)}px)` : 'none';
    ctx.drawImage(image, 0, 0, width, height);
    ctx.restore();
  };
  image.onerror = () => {
    if (!image.crossOrigin) return;
    image.crossOrigin = '';
    image.src = url;
  };
  image.src = url;
  return true;
}

function resolveScratchCoverLiveFrame({
  node,
  rootGroupId,
  ctx,
  playheadMs,
}: {
  node: WidgetNode;
  rootGroupId: string;
  ctx: RenderContext;
  playheadMs: number;
}): WidgetNode['frame'] {
  const liveFrame = getLiveWidgetFrame(node, playheadMs);
  let nextX = liveFrame.x;
  let nextY = liveFrame.y;
  let currentParentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (currentParentId && currentParentId !== rootGroupId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = ctx.widgetsById[currentParentId];
    if (!parent) break;
    const parentLiveFrame = getLiveWidgetFrame(parent, playheadMs);
    nextX += parentLiveFrame.x - parent.frame.x;
    nextY += parentLiveFrame.y - parent.frame.y;
    currentParentId = parent.parentId;
  }

  return {
    ...liveFrame,
    x: nextX,
    y: nextY,
  };
}

function resolveScratchCoverOpacity({
  node,
  rootGroupId,
  ctx,
  playheadMs,
}: {
  node: WidgetNode;
  rootGroupId: string;
  ctx: RenderContext;
  playheadMs: number;
}): number {
  let opacity = getLiveWidgetOpacity(node, playheadMs);
  let currentParentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (currentParentId && currentParentId !== rootGroupId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = ctx.widgetsById[currentParentId];
    if (!parent) break;
    opacity *= getLiveWidgetOpacity(parent, playheadMs);
    currentParentId = parent.parentId;
  }

  return Math.max(0, Math.min(1, opacity));
}

function paintScratchCoverWidget({
  canvasCtx,
  node,
  rootFrame,
  rootGroupId,
  renderCtx,
  playheadMs,
  excludedTargetIds,
  coverBlur,
  shouldPaint,
  visited,
}: {
  canvasCtx: CanvasRenderingContext2D;
  node: WidgetNode;
  rootFrame: WidgetNode['frame'];
  rootGroupId: string;
  renderCtx: RenderContext;
  playheadMs: number;
  excludedTargetIds: ReadonlySet<string>;
  coverBlur: number;
  shouldPaint: () => boolean;
  visited: Set<string>;
}): boolean {
  if (visited.has(node.id) || node.hidden || !isWidgetVisibleAt(node, playheadMs)) return false;
  visited.add(node.id);
  if (excludedTargetIds.has(node.id)) return false;

  const liveFrame = renderCtx.previewMode && renderCtx.isReproducing
    ? node.frame
    : resolveScratchCoverLiveFrame({ node, rootGroupId, ctx: renderCtx, playheadMs });
  const liveOpacity = renderCtx.previewMode && renderCtx.isReproducing
    ? Math.max(0, Math.min(1, Number(node.style.opacity ?? 1)))
    : resolveScratchCoverOpacity({ node, rootGroupId, ctx: renderCtx, playheadMs });
  const paintNode: WidgetNode = {
    ...node,
    frame: {
      ...node.frame,
      width: liveFrame.width,
      height: liveFrame.height,
    },
  };

  let painted = false;
  canvasCtx.save();
  canvasCtx.globalAlpha = Number.isFinite(Number(canvasCtx.globalAlpha))
    ? Number(canvasCtx.globalAlpha) * liveOpacity
    : liveOpacity;
  canvasCtx.translate?.(liveFrame.x - rootFrame.x + liveFrame.width / 2, liveFrame.y - rootFrame.y + liveFrame.height / 2);
  canvasCtx.rotate?.((liveFrame.rotation * Math.PI) / 180);
  canvasCtx.translate?.(-liveFrame.width / 2, -liveFrame.height / 2);

  if (node.type === 'group') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
  } else if (node.type === 'image' || node.type === 'hero-image') {
    painted = drawImageCover(
      canvasCtx,
      String(node.props.src ?? ''),
      liveFrame.width,
      liveFrame.height,
      coverBlur,
      shouldPaint,
    ) || painted;
  } else if (node.type === 'cta') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
    painted = drawCoverText(canvasCtx, String(node.props.text ?? node.name), paintNode, renderCtx) || painted;
  } else if (node.type === 'text' || node.type === 'badge') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
    painted = drawCoverText(canvasCtx, String(node.props.text ?? node.props.label ?? node.name), paintNode, renderCtx) || painted;
  } else if (node.type === 'shape') {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
  } else {
    painted = drawCoverBackground(canvasCtx, paintNode, renderCtx) || painted;
  }

  canvasCtx.restore();

  if (node.type === 'group' && node.childIds?.length) {
    let childPainted = false;
    node.childIds
      .map((childId) => renderCtx.widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child))
      .sort((left, right) => left.zIndex - right.zIndex)
      .forEach((child) => {
        childPainted = paintScratchCoverWidget({
          canvasCtx,
          node: child,
          rootFrame,
          rootGroupId,
          renderCtx,
          playheadMs,
          excludedTargetIds,
          coverBlur,
          shouldPaint,
          visited,
        }) || childPainted;
      });
    painted = childPainted || painted;
  }

  return painted;
}

function paintScratchGroupedCoverSnapshot({
  canvasCtx,
  root,
  renderCtx,
  playheadMs,
  excludedTargetIds,
  coverBlur,
  shouldPaint,
}: {
  canvasCtx: CanvasRenderingContext2D;
  root: WidgetNode;
  renderCtx: RenderContext;
  playheadMs: number;
  excludedTargetIds: ReadonlySet<string>;
  coverBlur: number;
  shouldPaint: () => boolean;
}): boolean {
  const rootFrame = root.frame;
  const visited = new Set<string>();
  let painted = false;
  (root.childIds ?? [])
    .map((childId) => renderCtx.widgetsById[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .sort((left, right) => left.zIndex - right.zIndex)
    .forEach((child) => {
      painted = paintScratchCoverWidget({
        canvasCtx,
        node: child,
        rootFrame,
        rootGroupId: root.id,
        renderCtx,
        playheadMs,
        excludedTargetIds,
        coverBlur,
        shouldPaint,
        visited,
      }) || painted;
    });
  return painted;
}

function ScratchGroupRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const nodeId = node.id;
  const ctxRef = useLatestRef(ctx);
  const nodeRef = useLatestRef(node);
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(
    0,
    Math.min(100, Number(node.props.autoRevealThresholdPercent ?? DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD)),
  );
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const coverColor = resolveScratchCoverColorForNode(node, ctx);
  const boxShadow = shadowConfigToBoxShadow(readShadowFromStyle(node.style));
  const rawMilestones = Array.isArray(node.props.scratchMilestones)
    ? (node.props.scratchMilestones as ScratchMilestone[])
    : DEFAULT_SCRATCH_MILESTONES;
  const milestonesKey = rawMilestones
    .map((milestone) => `${milestone.id}:${milestone.thresholdPercent}:${milestone.emitTrigger}`)
    .join('|');
  const coverDescriptor = useMemo(() => ({ kind: 'color', value: coverColor } as const), [coverColor]);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!ctx.previewMode) return undefined;
    let previousPlayheadMs = playbackEngine.getCurrentMs();
    let previousPreviewMode = ctxRef.current.previewMode;

    const checkRewind = (nextMs: number) => {
      const nextPreviewMode = ctxRef.current.previewMode;
      if (!nextPreviewMode) {
        previousPlayheadMs = nextMs;
        previousPreviewMode = false;
        return;
      }
      if (nextPreviewMode === previousPreviewMode && nextMs === previousPlayheadMs) {
        return;
      }
      const enteredPreview = nextPreviewMode && !previousPreviewMode;
      const rewoundToStart = nextPreviewMode && nextMs === 0 && previousPlayheadMs > 0;
      previousPlayheadMs = nextMs;
      previousPreviewMode = nextPreviewMode;
      if (enteredPreview || rewoundToStart) {
        setResetKey((value) => value + 1);
      }
    };

    return playbackEngine.subscribeDom(checkRewind);
  }, [ctx.previewMode, ctxRef]);

  const handleReveal = useCallback((cleared: number) => {
    ctxRef.current.triggerWidgetAction('scratch-complete', {
      clearedPercent: Math.round(cleared * 10000) / 100,
      thresholdPercent: autoRevealThresholdPercent,
      completedAtMs: playbackEngine.getCurrentMs(),
    });
  }, [autoRevealThresholdPercent, ctxRef]);

  const paintGroupedCover = useCallback(({ ctx: canvasCtx }: { ctx: CanvasRenderingContext2D }) => {
    const currentCtx = ctxRef.current;
    const currentNode = nodeRef.current;
    const excludedTargetIds = resolveScratchInternalTargetIds(currentNode, currentCtx.widgetsById);
    const playheadMs = currentCtx.previewMode && currentCtx.isReproducing
      ? playbackEngine.getCurrentMs()
      : currentCtx.playheadMs;
    return paintScratchGroupedCoverSnapshot({
      canvasCtx,
      root: currentNode,
      renderCtx: currentCtx,
      playheadMs,
      excludedTargetIds,
      coverBlur,
      shouldPaint: () => true,
    });
  }, [coverBlur, ctxRef, nodeRef]);

  return (
    <ScratchSurface
      className=""
      threshold={autoRevealThresholdPercent / 100}
      brushSize={scratchRadius}
      activationDelayMs={0}
      fadeOutMs={120}
      cover={coverDescriptor}
      coverKey={`${nodeId}:${coverColor}:${coverBlur}:${milestonesKey}:${scratchRadius}:${autoRevealThresholdPercent}`}
      resetKey={resetKey}
      onReveal={handleReveal}
      paintCover={paintGroupedCover}
      style={{
        ...scratchShellStyle,
        borderRadius: Number(node.style.borderRadius ?? 18),
        boxShadow,
      }}
    />
  );
}

function useScratchGroupActiveState(node: WidgetNode, ctx: RenderContext): boolean {
  const ctxRef = useLatestRef(ctx);
  const nodeRef = useLatestRef(node);
  const [active, setActive] = useState(() => isScratchGroupActive({
    group: node,
    widgetsById: ctx.widgetsById,
    playheadMs: ctx.playheadMs,
  }));

  useEffect(() => {
    if (!node.props.scratchEnabled) {
      setActive(false);
      return undefined;
    }

    const sync = (nextMs: number) => {
      const nextActive = isScratchGroupActive({
        group: nodeRef.current,
        widgetsById: ctxRef.current.widgetsById,
        playheadMs: nextMs,
      });
      setActive((current) => (current === nextActive ? current : nextActive));
    };

    if (!ctx.previewMode || !ctx.isReproducing) {
      sync(ctx.playheadMs);
      return undefined;
    }

    sync(playbackEngine.getCurrentMs());
    return playbackEngine.subscribeDom(sync);
  }, [
    ctx.previewMode,
    ctx.isReproducing,
    ctx.playheadMs,
    ctx.widgetsById,
    ctxRef,
    node.id,
    node.props.scratchEnabled,
    node.props.scratchActivationMode,
    node.props.scratchActivationDelayMs,
    node.timeline.startMs,
    nodeRef,
  ]);

  return active;
}

export function renderGroupWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  if (!node.props.scratchEnabled) {
    return renderDefaultGroup(node, ctx);
  }

  if (!ctx.previewMode) {
    return <div style={scratchEditorOverlayStyle} />;
  }

  return <GroupScratchRoot node={node} ctx={ctx} />;
}

function GroupScratchRoot({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const scratchGroupActive = useScratchGroupActiveState(node, ctx);
  if (!scratchGroupActive) {
    return renderDefaultGroup(node, ctx);
  }

  return <ScratchGroupRenderer node={node} ctx={ctx} />;
}

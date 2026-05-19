import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { getLiveWidgetFrame, getLiveWidgetOpacity, isWidgetVisibleAt } from '../../domain/document/timeline';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetColor, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { renderWidgetContents } from '../../canvas/stage/render-widget';
import { playbackEngine } from '../../hooks/use-playback-engine';
import { useLatestRef } from '../../shared/hooks';
import { readShadowFromStyle, shadowConfigToBoxShadow } from '../../shared/style/shadow';
import { isScratchGroupActive } from './group-scratch-activation';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  DEFAULT_SCRATCH_MILESTONES,
} from './group-scratch-constants';
import { resolveScratchInternalTargetIds } from './group-reveal-target';
import {
  createScratchMaskEngine,
  initializeScratchPathElement,
  type ScratchMaskEngine,
} from './scratch-mask-engine';

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

function buildScratchMaskStyle(maskId: string, blur: number): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    filter: blur > 0 ? `blur(${blur}px)` : 'none',
    WebkitMask: `url(#${maskId})`,
    mask: `url(#${maskId})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };
}

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

function renderScratchDuplicatedNode(
  node: WidgetNode,
  rootFrame: WidgetNode['frame'],
  rootGroupId: string,
  ctx: RenderContext,
  playheadMs: number,
  excludedIds?: ReadonlySet<string>,
  visited = new Set<string>(),
): JSX.Element[] {
  if (visited.has(node.id) || excludedIds?.has(node.id) || !isWidgetVisibleAt(node, playheadMs)) return [];
  visited.add(node.id);

  if (node.type === 'group' && node.childIds?.length) {
    const childNodes = node.childIds
      .map((childId) => ctx.widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child))
      .sort((left, right) => left.zIndex - right.zIndex)
      .flatMap((child) => renderScratchDuplicatedNode(child, rootFrame, rootGroupId, ctx, playheadMs, excludedIds, visited));

    return [
      (
        <ScratchCoverWidget
          key={node.id}
          node={node}
          rootFrame={rootFrame}
          rootGroupId={rootGroupId}
          ctx={ctx}
          playheadMs={playheadMs}
        />
      ),
      ...childNodes,
    ];
  }

  return [
    (
      <ScratchCoverWidget
        key={node.id}
        node={node}
        rootFrame={rootFrame}
        rootGroupId={rootGroupId}
        ctx={ctx}
        playheadMs={playheadMs}
      />
    ),
  ];
}

function ScratchCoverWidget({
  node,
  rootFrame,
  rootGroupId,
  ctx,
  playheadMs,
}: {
  node: WidgetNode;
  rootFrame: WidgetNode['frame'];
  rootGroupId: string;
  ctx: RenderContext;
  playheadMs: number;
}): JSX.Element {
  const liveFrame = ctx.previewMode && ctx.isReproducing
    ? node.frame
    : resolveScratchCoverLiveFrame({ node, rootGroupId, ctx, playheadMs });
  const liveOpacity = ctx.previewMode && ctx.isReproducing
    ? Math.max(0, Math.min(1, Number(node.style.opacity ?? 1)))
    : resolveScratchCoverOpacity({ node, rootGroupId, ctx, playheadMs });
  const contentNode: WidgetNode = {
    ...node,
    frame: {
      ...liveFrame,
      x: 0,
      y: 0,
      rotation: 0,
    },
    style: {
      ...node.style,
      opacity: 1,
    },
    props: node.type === 'group'
      ? {
          ...node.props,
          scratchEnabled: false,
        }
      : node.props,
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: liveFrame.width,
        height: liveFrame.height,
        opacity: liveOpacity,
        zIndex: node.zIndex,
        transform: `translate3d(${liveFrame.x - rootFrame.x}px, ${liveFrame.y - rootFrame.y}px, 0) rotate(${liveFrame.rotation}deg)`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
      }}
    >
      {renderWidgetContents(
        contentNode,
        {
          ...ctx,
          hovered: false,
          active: false,
        },
      )}
    </div>
  );
}

function GroupScratchCoverChildren({
  node,
  ctx,
  playheadMs,
  excludedIds,
}: {
  node: WidgetNode;
  ctx: RenderContext;
  playheadMs: number;
  excludedIds?: ReadonlySet<string>;
}): JSX.Element | null {
  const childWidgets = (node.childIds ?? [])
    .map((childId) => ctx.widgetsById[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .filter((child) => !excludedIds?.has(child.id))
    .sort((left, right) => left.zIndex - right.zIndex);

  const scratchNodes = childWidgets.flatMap((child) => renderScratchDuplicatedNode(child, node.frame, node.id, ctx, playheadMs, excludedIds));
  if (!scratchNodes.length) return null;

  return <>{scratchNodes}</>;
}

function GroupScratchTargetChildren({
  node,
  ctx,
  playheadMs,
  includedIds,
}: {
  node: WidgetNode;
  ctx: RenderContext;
  playheadMs: number;
  includedIds: ReadonlySet<string>;
}): JSX.Element | null {
  if (!includedIds.size) return null;

  const targetRootWidgets: WidgetNode[] = [];
  const visited = new Set<string>();
  const collectRoots = (widgetId: string): void => {
    if (visited.has(widgetId)) return;
    visited.add(widgetId);
    const widget = ctx.widgetsById[widgetId];
    if (!widget) return;
    if (includedIds.has(widget.id)) {
      if (!widget.parentId || !includedIds.has(widget.parentId)) {
        targetRootWidgets.push(widget);
      }
      return;
    }
    (widget.childIds ?? []).forEach(collectRoots);
  };

  (node.childIds ?? []).forEach(collectRoots);
  targetRootWidgets.sort((left, right) => left.zIndex - right.zIndex);

  const targetNodes = targetRootWidgets.flatMap((child) => renderScratchDuplicatedNode(child, node.frame, node.id, ctx, playheadMs));
  if (!targetNodes.length) return null;

  return <>{targetNodes}</>;
}

function ScratchGroupRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const playheadMs = ctx.playheadMs;
  const previewMode = ctx.previewMode;
  const nodeId = node.id;
  const ctxRef = useLatestRef(ctx);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const maskPathRef = useRef<SVGPathElement | null>(null);
  const engineRef = useRef<ScratchMaskEngine | null>(null);
  const maskSizeRef = useRef({ width: 0, height: 0 });
  const pendingResizeResetRef = useRef(false);
  const scratchCompletedRef = useRef(false);
  const [scratchCompleted, setScratchCompleted] = useState(false);
  const [shellSize, setShellSize] = useState(() => ({
    width: Math.max(1, Math.round(node.frame.width || 1)),
    height: Math.max(1, Math.round(node.frame.height || 1)),
  }));
  const scratchRadius = Math.max(8, Number(node.props.scratchRadius ?? 22));
  const autoRevealThresholdPercent = Math.max(
    0,
    Math.min(100, Number(node.props.autoRevealThresholdPercent ?? DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD)),
  );
  const coverBlur = Math.max(0, Number(node.props.coverBlur ?? 0));
  const boxShadow = shadowConfigToBoxShadow(readShadowFromStyle(node.style));
  const milestones = Array.isArray(node.props.scratchMilestones)
    ? node.props.scratchMilestones
    : DEFAULT_SCRATCH_MILESTONES;
  const milestonesKey = milestones
    .map((milestone) => `${milestone.id}:${milestone.thresholdPercent}:${milestone.emitTrigger}`)
    .join('|');
  const maskId = `scratch-mask-${nodeId}`;
  const childIdsKey = (node.childIds ?? []).join('|');
  const internalTargetIds = useMemo(
    () => resolveScratchInternalTargetIds(node, ctx.widgetsById),
    [
      ctx.widgetsById,
      childIdsKey,
      nodeId,
      node.props.revealTargetId,
      node.props.revealTargetMode,
    ],
  );

  const resetScratchMask = ({ force = false, clearCompletion = false } = {}) => {
    const shell = shellRef.current;
    const pathElement = maskPathRef.current;
    if (!shell) return;
    if (scratchCompletedRef.current && !clearCompletion) return;
    const width = Math.max(1, Math.round(shell?.clientWidth ?? node.frame.width ?? 1));
    const height = Math.max(1, Math.round(shell?.clientHeight ?? node.frame.height ?? 1));
    const dimensionsChanged = maskSizeRef.current.width !== width || maskSizeRef.current.height !== height;
    if (!force && !dimensionsChanged) return;
    const didResetEngine = engineRef.current?.reset({ force }) ?? true;
    if (!didResetEngine) {
      pendingResizeResetRef.current = true;
      return;
    }
    maskSizeRef.current = { width, height };
    initializeScratchPathElement(pathElement, scratchRadius);
    pendingResizeResetRef.current = false;
    if (clearCompletion && scratchCompletedRef.current) {
      scratchCompletedRef.current = false;
      setScratchCompleted(false);
    }
  };

  const flushPendingResizeReset = () => {
    if (!pendingResizeResetRef.current) return;
    if (!engineRef.current || engineRef.current.isCompleted()) return;
    pendingResizeResetRef.current = false;
    resetScratchMask();
  };

  useLayoutEffect(() => {
    if (!shellRef.current || !maskPathRef.current) return;
    engineRef.current?.dispose();
    engineRef.current = createScratchMaskEngine({
      shell: shellRef.current,
      maskPath: maskPathRef.current,
      radius: scratchRadius,
      autoRevealThresholdPercent,
      milestones,
      onMilestone: () => undefined,
      onComplete: (clearedPercent) => {
        const completedAtMs = playbackEngine.getCurrentMs();
        scratchCompletedRef.current = true;
        setScratchCompleted(true);
        ctxRef.current.triggerWidgetAction('scratch-complete', {
          clearedPercent,
          thresholdPercent: autoRevealThresholdPercent,
          completedAtMs,
        });
      },
    });
    resetScratchMask({ force: true });
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [autoRevealThresholdPercent, ctxRef, milestonesKey, scratchRadius]);

  useLayoutEffect(() => {
    resetScratchMask({ force: false });
  }, [node.frame.width, node.frame.height, previewMode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return undefined;
    const updateShellSize = (width: number, height: number) => {
      const nextSize = {
        width: Math.max(1, Math.round(width || node.frame.width || 1)),
        height: Math.max(1, Math.round(height || node.frame.height || 1)),
      };
      setShellSize((current) => (
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      ));
      return nextSize;
    };
    updateShellSize(shell.clientWidth, shell.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const nextSize = updateShellSize(
        entry?.contentRect.width ?? shell.clientWidth,
        entry?.contentRect.height ?? shell.clientHeight,
      );
      const previousSize = maskSizeRef.current;
      const widthDelta = Math.abs(nextSize.width - previousSize.width) / Math.max(1, previousSize.width);
      const heightDelta = Math.abs(nextSize.height - previousSize.height) / Math.max(1, previousSize.height);
      if (widthDelta < 0.05 && heightDelta < 0.05) return;
      resetScratchMask();
      pendingResizeResetRef.current = false;
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [node.frame.height, node.frame.width, nodeId, previewMode]);

  useEffect(() => {
    if (!previewMode) return undefined;
    let previousPlayheadMs = playbackEngine.getCurrentMs();
    let previousPreviewMode = ctxRef.current.previewMode;

    const checkRewind = (nextMs: number) => {
      const previewMode = ctxRef.current.previewMode;
      if (!previewMode) {
        previousPlayheadMs = nextMs;
        previousPreviewMode = false;
        return;
      }
      if (previewMode === previousPreviewMode && nextMs === previousPlayheadMs) {
        return;
      }
      const enteredPreview = previewMode && !previousPreviewMode;
      const rewoundToStart = previewMode && nextMs === 0 && previousPlayheadMs > 0;
      previousPlayheadMs = nextMs;
      previousPreviewMode = previewMode;
      if (enteredPreview || rewoundToStart) {
        resetScratchMask({ force: true, clearCompletion: true });
      }
    };

    return playbackEngine.subscribeDom(checkRewind);
  }, [ctxRef, previewMode]);

  const scratchAtEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!engineRef.current || scratchCompleted) return;
    const { clientX, clientY } = event;
    if (event.type === 'pointerdown') {
      engineRef.current.handlePointerDown(clientX, clientY);
      return;
    }
    engineRef.current.handlePointerMove(clientX, clientY);
  };

  const targetContent = useMemo(() => (
    <GroupScratchTargetChildren
      node={node}
      ctx={ctx}
      playheadMs={playheadMs}
      includedIds={internalTargetIds}
    />
  ), [ctx.isReproducing, ctx.previewMode, ctx.widgetsById, internalTargetIds, node, playheadMs]);
  const scratchContent = useMemo(() => (
    <GroupScratchCoverChildren
      node={node}
      ctx={ctx}
      playheadMs={playheadMs}
      excludedIds={internalTargetIds}
    />
  ), [ctx.isReproducing, ctx.previewMode, ctx.widgetsById, internalTargetIds, node, playheadMs]);

  return (
    <div
      ref={shellRef}
      data-scratch-shell
      data-scratch-widget-id={nodeId}
      style={{ ...scratchShellStyle, borderRadius: Number(node.style.borderRadius ?? 18), boxShadow }}
    >
      {targetContent ? (
        <div
          data-scratch-target-layer
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          {targetContent}
        </div>
      ) : null}
      <svg
        aria-hidden="true"
        focusable="false"
        data-scratch-mask-svg
        viewBox={`0 0 ${shellSize.width} ${shellSize.height}`}
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect x={0} y={0} width={shellSize.width} height={shellSize.height} fill="white" />
            <path ref={maskPathRef} d="" stroke="black" strokeWidth={scratchRadius * 2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </mask>
        </defs>
      </svg>
      {scratchContent ? (
        <div
          data-scratch-mask-target
          data-scratch-cover-layer
          style={scratchCompleted ? { display: 'none' } : { ...buildScratchMaskStyle(maskId, coverBlur) }}
        >
          {scratchContent}
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          cursor: scratchCompleted ? 'default' : 'crosshair',
          touchAction: 'none',
          outline: 'none',
          background: 'transparent',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          pointerEvents: scratchCompleted ? 'none' : 'auto',
        }}
        data-scratch-hit-area
        data-scratch-completed={scratchCompleted ? 'true' : 'false'}
        onPointerDown={(event) => {
          if (scratchCompleted || !event.isPrimary) return;
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          scratchAtEvent(event);
        }}
        onPointerMove={(event) => {
          if (scratchCompleted) return;
          event.preventDefault();
          scratchAtEvent(event);
        }}
        onPointerUp={(event) => {
          engineRef.current?.handlePointerUp();
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          flushPendingResizeReset();
        }}
        onPointerCancel={(event) => {
          engineRef.current?.handlePointerUp();
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          flushPendingResizeReset();
        }}
        onLostPointerCapture={() => {
          engineRef.current?.handlePointerUp();
          flushPendingResizeReset();
        }}
      />
    </div>
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

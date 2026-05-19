// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { parseDragTokenItems } from './drag-token-pool.types';
import { subscribeTokenDrag, type TokenDragDetail } from './token-drag-runtime';
import { useLatestRef } from '../../shared/hooks';

function parseActionMap(raw: unknown): Record<string, string> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === 'string' && value.trim()) acc[key] = value;
      return acc;
    }, {});
  }
  try {
    const parsed = JSON.parse(String(raw ?? '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function resolveFallbackActionId(node: WidgetNode, tokenId: string): string | undefined {
  const map = parseActionMap(node.props.matchActionMap);
  const mappedActionId = map[tokenId];
  if (mappedActionId) return mappedActionId;
  const legacyActionId = String(node.props.onMatchAction ?? '').trim();
  return legacyActionId || undefined;
}

const dropZoneShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dropZoneBaseStyle: CSSProperties = {
  borderRadius: '50%',
  position: 'relative',
};

const dropZoneHighlightBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  pointerEvents: 'none',
  opacity: 0,
  willChange: 'opacity',
  transition: 'opacity 0.12s ease-out',
};

function buildDropZoneStyle(
  width: number,
  height: number,
  hitPadding: number,
  previewMode: boolean,
  debugOutline: boolean,
): CSSProperties {
  return {
    ...dropZoneBaseStyle,
    width: width + hitPadding * 2,
    height: height + hitPadding * 2,
    border: !previewMode && debugOutline ? '2px dashed var(--white-a-45)' : 'none',
    background: !previewMode && debugOutline ? 'var(--white-a-4)' : 'transparent',
  };
}

function buildDropZoneHighlightStyle(isOver: boolean): CSSProperties {
  return {
    ...dropZoneHighlightBaseStyle,
    opacity: isOver ? 1 : 0,
    background: 'var(--accent-cyan-a-12)',
    border: '2px dashed var(--accent-cyan-bright)',
  };
}

function buildDropZoneLabelStyle(isVisible: boolean): CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: 8,
    transform: 'translateX(-50%)',
    padding: '4px 8px',
    borderRadius: 999,
    background: 'var(--black-a-65)',
    color: 'var(--white)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
    opacity: isVisible ? 1 : 0,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  };
}

function resolveTokenDropTargets(
  ctx: RenderContext,
  detail: TokenDragDetail,
): { targetSceneId?: string; targetActionId?: string } {
  const sourceWidget = ctx.widgetsById[detail.sourceWidgetId];
  if (sourceWidget?.type === 'drag-token-pool') {
    const token = parseDragTokenItems(sourceWidget.props.tokens).find((item) => item.id === detail.tokenId);
    const targetActionId = typeof token?.targetActionId === 'string' && token.targetActionId.trim()
      ? token.targetActionId
      : undefined;
    const targetSceneId = typeof token?.targetSceneId === 'string' && token.targetSceneId.trim()
      ? token.targetSceneId
      : undefined;
    if (targetActionId || targetSceneId) {
      return {
        targetActionId,
        targetSceneId: targetActionId ? undefined : targetSceneId,
      };
    }
  }

  const eventTargetActionId = typeof detail.targetActionId === 'string' && detail.targetActionId.trim()
    ? detail.targetActionId
    : undefined;
  const eventTargetSceneId = typeof detail.targetSceneId === 'string' && detail.targetSceneId.trim()
    ? detail.targetSceneId
    : undefined;
  if (eventTargetActionId || eventTargetSceneId) {
    return {
      targetActionId: eventTargetActionId,
      targetSceneId: eventTargetActionId ? undefined : eventTargetSceneId,
    };
  }
  return {};
}

function acceptsTokenSource(
  ctx: RenderContext,
  dropZoneWidgetId: string,
  detail: TokenDragDetail,
): boolean {
  const eventDropTargetId = String(detail.dropTargetId ?? '').trim();
  if (eventDropTargetId === dropZoneWidgetId) return true;
  const sourceWidget = ctx.widgetsById[detail.sourceWidgetId];
  if (!sourceWidget || sourceWidget.type !== 'drag-token-pool') return false;
  const configuredDropTargetId = String(sourceWidget.props.dropTargetId ?? '').trim();
  return !configuredDropTargetId || configuredDropTargetId === dropZoneWidgetId;
}

function DropZoneRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const ctxRef = useLatestRef(ctx);
  const nodeRef = useLatestRef(node);
  const [isOver, setIsOver] = useState(false);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const lastIsOverRef = useRef(false);
  const width = Math.max(20, Number(node.frame.width ?? node.props.width ?? 120));
  const height = Math.max(20, Number(node.frame.height ?? node.props.height ?? 120));
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const debugOutline = Boolean(node.props.debugOutline ?? true);
  useEffect(() => {
    const invalidateRect = () => {
      cachedRectRef.current = null;
    };

    const addInvalidationListeners = () => {
      window.addEventListener('resize', invalidateRect);
      document.addEventListener('scroll', invalidateRect, true);
    };

    const removeInvalidationListeners = () => {
      window.removeEventListener('resize', invalidateRect);
      document.removeEventListener('scroll', invalidateRect, true);
    };

    const unsubscribe = subscribeTokenDrag((detail) => {
      const element = zoneRef.current;
      if (!element) return;

      if (detail.phase === 'start') {
        cachedRectRef.current = element.getBoundingClientRect();
        addInvalidationListeners();
        const rect = cachedRectRef.current;
        const inside = detail.clientX >= rect.left && detail.clientX <= rect.right && detail.clientY >= rect.top && detail.clientY <= rect.bottom;
        if (inside !== lastIsOverRef.current) {
          lastIsOverRef.current = inside;
          setIsOver(inside);
        }
        return;
      }

      if (detail.phase === 'move') {
        if (!cachedRectRef.current) {
          cachedRectRef.current = element.getBoundingClientRect();
        }
        const rect = cachedRectRef.current;
        const inside = detail.clientX >= rect.left && detail.clientX <= rect.right && detail.clientY >= rect.top && detail.clientY <= rect.bottom;
        if (inside !== lastIsOverRef.current) {
          lastIsOverRef.current = inside;
          setIsOver(inside);
        }
        return;
      }

      const rect = element.getBoundingClientRect();
      const inside = detail.clientX >= rect.left && detail.clientX <= rect.right && detail.clientY >= rect.top && detail.clientY <= rect.bottom;
      if (detail.phase === 'end' && inside && acceptsTokenSource(ctxRef.current, nodeRef.current.id, detail)) {
        const { targetActionId, targetSceneId } = resolveTokenDropTargets(ctxRef.current, detail);
        if (targetActionId) {
          ctxRef.current.executeAction?.(targetActionId);
        } else if (targetSceneId) {
          ctxRef.current.goToScene?.(targetSceneId);
        } else {
          const actionId = resolveFallbackActionId(nodeRef.current, detail.tokenId);
          if (actionId) {
            ctxRef.current.executeAction?.(actionId);
          } else {
            ctxRef.current.triggerWidgetAction('click');
          }
        }
      }

      cachedRectRef.current = null;
      lastIsOverRef.current = false;
      setIsOver(false);
      removeInvalidationListeners();
    });

    return () => {
      unsubscribe();
      removeInvalidationListeners();
    };
  }, [node.id]);

  return (
    <div style={dropZoneShellStyle}>
      <div
        ref={zoneRef}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={buildDropZoneStyle(width, height, hitPadding, ctx.previewMode, debugOutline)}
      >
        <div style={buildDropZoneHighlightStyle(isOver)} />
        {!ctx.previewMode && debugOutline ? (
          <div style={buildDropZoneLabelStyle(true)}>
            Drag trigger area
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function renderDropZoneStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DropZoneRenderer node={node} ctx={ctx} />;
}

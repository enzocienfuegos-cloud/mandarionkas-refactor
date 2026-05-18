// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import type { DragTokenItem } from './drag-token-pool.types';
import { subscribeTokenDrag } from './token-drag-runtime';

function parseActionMap(raw: unknown): Record<string, string> {
  try {
    const parsed = JSON.parse(String(raw ?? '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
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
  debugOutline: boolean,
): CSSProperties {
  return {
    ...dropZoneBaseStyle,
    width: width + hitPadding * 2,
    height: height + hitPadding * 2,
    border: debugOutline ? '2px dashed var(--white-a-45)' : 'none',
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

function resolveTokenTargetSceneId(
  ctx: RenderContext,
  sourceWidgetId: string,
  tokenId: string,
): string | undefined {
  const sourceWidget = ctx.widgetsById[sourceWidgetId];
  if (!sourceWidget || sourceWidget.type !== 'drag-token-pool') return undefined;
  const tokens = Array.isArray(sourceWidget.props.tokens) ? sourceWidget.props.tokens as DragTokenItem[] : [];
  return tokens.find((token) => token.id === tokenId)?.targetSceneId;
}

function DropZoneRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const [isOver, setIsOver] = useState(false);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const lastIsOverRef = useRef(false);
  const width = Math.max(20, Number(node.props.width ?? 120));
  const height = Math.max(20, Number(node.props.height ?? 120));
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const debugOutline = Boolean(node.props.debugOutline ?? true);
  const matchActionMap = parseActionMap(node.props.matchActionMap);

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
      if (detail.phase === 'end' && inside) {
        const targetSceneId = resolveTokenTargetSceneId(ctx, detail.sourceWidgetId, detail.tokenId);
        if (targetSceneId) {
          ctx.goToScene?.(targetSceneId);
        } else {
          const actionId = matchActionMap[detail.tokenId];
          if (actionId) {
            ctx.executeAction?.(actionId);
          } else {
            ctx.triggerWidgetAction('click');
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
  }, [ctx, matchActionMap]);

  return (
    <div style={dropZoneShellStyle}>
      <div
        ref={zoneRef}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        style={buildDropZoneStyle(width, height, hitPadding, debugOutline)}
      >
        <div style={buildDropZoneHighlightStyle(isOver)} />
      </div>
    </div>
  );
}

export function renderDropZoneStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DropZoneRenderer node={node} ctx={ctx} />;
}

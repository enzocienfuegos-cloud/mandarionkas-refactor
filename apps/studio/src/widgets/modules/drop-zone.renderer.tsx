// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useCallback, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { parseDragTokenItems } from './drag-token-pool.types';
import { useDropTarget } from '../../core/drag-runtime';
import type { DragSourceConfig } from '../../core/drag-runtime';
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
  source: DragSourceConfig,
): { targetActionId?: string; targetSceneId?: string } {
  const sourceWidget = ctx.widgetsById[source.sourceWidgetId];
  console.log('[DropZone] resolveTokenDropTargets', { sourceWidgetId: source.sourceWidgetId, sourceWidgetFound: Boolean(sourceWidget), sourceWidgetType: sourceWidget?.type, tokenId: source.tokenId, payload: source.payload });
  if (sourceWidget?.type === 'drag-token-pool') {
    const token = parseDragTokenItems(sourceWidget.props.tokens).find((item) => item.id === source.tokenId);
    console.log('[DropZone] token lookup', { tokenFound: Boolean(token), tokenTargetSceneId: token?.targetSceneId, tokenTargetActionId: token?.targetActionId });
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

  const eventTargetActionId = typeof source.payload.targetActionId === 'string' && source.payload.targetActionId.trim()
    ? source.payload.targetActionId
    : undefined;
  const eventTargetSceneId = typeof source.payload.targetSceneId === 'string' && source.payload.targetSceneId.trim()
    ? source.payload.targetSceneId
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
  source: DragSourceConfig,
): boolean {
  const configuredDropTargetId = String(source.dropTargetId ?? '').trim();
  if (configuredDropTargetId === dropZoneWidgetId) return true;
  const sourceWidget = ctx.widgetsById[source.sourceWidgetId];
  if (!sourceWidget || sourceWidget.type !== 'drag-token-pool') return false;
  const widgetDropTargetId = String(sourceWidget.props.dropTargetId ?? '').trim();
  return !widgetDropTargetId || widgetDropTargetId === dropZoneWidgetId;
}

function DropZoneRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const ctxRef = useLatestRef(ctx);
  const nodeRef = useLatestRef(node);
  const width = Math.max(20, Number(node.frame.width ?? node.props.width ?? 120));
  const height = Math.max(20, Number(node.frame.height ?? node.props.height ?? 120));
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const debugOutline = Boolean(node.props.debugOutline ?? true);

  const accepts = useCallback(
    (source: DragSourceConfig) => acceptsTokenSource(ctxRef.current, nodeRef.current.id, source),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onDrop = useCallback(
    (source: DragSourceConfig) => {
      const { targetActionId, targetSceneId } = resolveTokenDropTargets(ctxRef.current, source);
      console.log('[DropZone] onDrop', { sourceWidgetId: source.sourceWidgetId, tokenId: source.tokenId, targetActionId, targetSceneId, hasGoToScene: Boolean(ctxRef.current.goToScene), hasExecuteAction: Boolean(ctxRef.current.executeAction) });
      if (targetActionId) {
        ctxRef.current.executeAction?.(targetActionId);
      } else if (targetSceneId) {
        ctxRef.current.goToScene?.(targetSceneId);
      } else {
        const actionId = resolveFallbackActionId(nodeRef.current, source.tokenId);
        console.log('[DropZone] fallback', { actionId, tokenId: source.tokenId });
        if (actionId) {
          ctxRef.current.executeAction?.(actionId);
        } else {
          ctxRef.current.triggerWidgetAction('click');
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { isOver, ref } = useDropTarget({
    targetId: node.id,
    hitPadding,
    onDrop,
    accepts,
  });

  return (
    <div style={dropZoneShellStyle}>
      <div
        ref={ref}
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

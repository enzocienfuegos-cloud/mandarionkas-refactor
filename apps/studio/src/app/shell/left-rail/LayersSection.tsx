import { useMemo, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { LeftRailController } from './use-left-rail-controller';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { SurfaceButton } from '../../../shared/ui/SurfaceButton';
import { useVirtualWindow, useVirtualWindowPadding } from '../../../shared/hooks/use-virtual-window';
import { getCapability } from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import { buildLayerOutline, flattenVisibleLayerIds, flattenVisibleLayerItems, getWidgetReorderSteps, type LayerOutlineItem } from './layer-outline';

export function LayersSection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { widgetActions, selectedIds, nodes, scenes, activeSceneId, scene, sceneActions } = controller;
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dropTargetWidgetId, setDropTargetWidgetId] = useState<string | null>(null);
  const layerScrollRef = useRef<HTMLDivElement>(null);
  const layerTreeRef = useRef<HTMLDivElement>(null);
  const selectedWidgets = selectedIds.map((widgetId) => nodes[widgetId]).filter(Boolean);
  const outline = useMemo(() => buildLayerOutline(scene, nodes), [nodes, scene]);
  const visibleLayerIds = useMemo(() => flattenVisibleLayerIds(outline, collapsedGroupIds), [outline, collapsedGroupIds]);
  const visibleOutlineItems = useMemo(() => flattenVisibleLayerItems(outline, collapsedGroupIds), [outline, collapsedGroupIds]);
  const virtualLayers = useVirtualWindow(visibleOutlineItems, {
    scrollRef: layerScrollRef,
    estimateSize: 54,
    overscan: 8,
  });
  useVirtualWindowPadding(layerTreeRef, virtualLayers.paddingStart, virtualLayers.paddingEnd);
  const selectedCount = selectedIds.length;

  function toggleGroup(widgetId: string): void {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(widgetId)) next.delete(widgetId);
      else next.add(widgetId);
      return next;
    });
  }

  function handleLayerSelection(widgetId: string, event?: ReactMouseEvent | ReactKeyboardEvent): void {
    const additive = Boolean(event && ('metaKey' in event ? (event.metaKey || event.ctrlKey || event.shiftKey) : false));
    widgetActions.selectWidget(widgetId, additive);
  }

  function handleLayerDrop(targetWidgetId: string): void {
    if (!draggedWidgetId || draggedWidgetId === targetWidgetId) return;
    const steps = getWidgetReorderSteps(scene.widgetIds, draggedWidgetId, targetWidgetId);
    steps.forEach((direction) => widgetActions.reorderWidget(draggedWidgetId, direction));
  }

  function renderLayerItem(item: LayerOutlineItem): JSX.Element {
    const definition = getWidgetDefinition(item.widget.type);
    const isSelected = selectedIds.includes(item.widget.id);
    const isGroup = Boolean(getCapability(definition, 'isContainer')) && item.children.length > 0;
    const isCollapsed = collapsedGroupIds.has(item.widget.id);
    const rowStyle = { '--layer-depth': item.depth } as CSSProperties;

    return (
      <div key={item.widget.id} className="layer-outline-node">
        <div
          draggable
          role="button"
          tabIndex={0}
          style={rowStyle}
          className={`layer-row layer-row--outline ${isSelected ? 'is-selected' : ''} ${dropTargetWidgetId === item.widget.id ? 'is-drop-target' : ''}`}
          onClick={(event) => handleLayerSelection(item.widget.id, event)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleLayerSelection(item.widget.id, event);
            }
            if (isGroup && event.key === 'ArrowLeft' && !isCollapsed) {
              event.preventDefault();
              toggleGroup(item.widget.id);
            }
            if (isGroup && event.key === 'ArrowRight' && isCollapsed) {
              event.preventDefault();
              toggleGroup(item.widget.id);
            }
          }}
          onDragStart={(event: ReactDragEvent<HTMLDivElement>) => {
            setDraggedWidgetId(item.widget.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.widget.id);
          }}
          onDragEnd={() => {
            setDraggedWidgetId(null);
            setDropTargetWidgetId(null);
          }}
          onDragOver={(event: ReactDragEvent<HTMLDivElement>) => {
            if (!draggedWidgetId || draggedWidgetId === item.widget.id) return;
            event.preventDefault();
            setDropTargetWidgetId(item.widget.id);
          }}
          onDragLeave={() => {
            if (dropTargetWidgetId === item.widget.id) {
              setDropTargetWidgetId(null);
            }
          }}
          onDrop={(event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            handleLayerDrop(item.widget.id);
            setDraggedWidgetId(null);
            setDropTargetWidgetId(null);
          }}
        >
          <div className="layer-row__main">
            <div className="layer-row__grip">
              <StudioIcon icon={StudioIcons.gripVertical} size={14} />
            </div>
            {isGroup ? (
              <SurfaceButton
                size="sm"
                className="layer-row__toggle"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleGroup(item.widget.id);
                }}
                aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
              >
                <StudioIcon icon={isCollapsed ? StudioIcons.chevronRight : StudioIcons.chevronDown} size={14} />
              </SurfaceButton>
            ) : (
              <span className="layer-row__toggle layer-row__toggle--placeholder" aria-hidden="true" />
            )}
            <div className="layer-meta">
              <strong>
                {definition.renderLabel(item.widget)}
                {item.widget.sharedLayerId ? (
                  <span className="layer-shared-indicator" aria-label="Shared layer">
                    <StudioIcon icon={StudioIcons.layers} size={12} />
                  </span>
                ) : null}
              </strong>
              <small className="muted">
                {item.widget.type}
                {' · '}
                {item.widget.hidden ? 'Hidden' : 'Visible'}
                {' · '}
                {item.widget.locked ? 'Locked' : 'Unlocked'}
                {item.widget.sharedLayerId ? ' · Shared' : ''}
              </small>
            </div>
          </div>
          <div className="layer-row__actions">
            <IconButton
              size="sm"
              label={item.widget.hidden ? 'Show layer' : 'Hide layer'}
              icon={<StudioIcon icon={item.widget.hidden ? StudioIcons.eyeOff : StudioIcons.eye} size={14} />}
              onClick={(event) => {
                event.stopPropagation();
                widgetActions.toggleWidgetHidden(item.widget.id);
              }}
            />
            <IconButton
              size="sm"
              label={item.widget.locked ? 'Unlock layer' : 'Lock layer'}
              icon={<StudioIcon icon={item.widget.locked ? StudioIcons.lock : StudioIcons.lockOpen} size={14} />}
              onClick={(event) => {
                event.stopPropagation();
                widgetActions.toggleWidgetLocked(item.widget.id);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="left-rail-section-head section-offset-top">
        <div>
          <div className="left-title">Layers</div>
          <strong className="rail-heading">Scene outline</strong>
        </div>
        <div className="pill">{selectedCount} selected</div>
      </div>
      <div className="field-stack rail-action-grid section-offset-bottom-lg">
        <Button className="left-button compact-action" size="sm" onClick={() => widgetActions.groupSelected()} disabled={selectedIds.length < 2}>Group</Button>
        <Button className="left-button compact-action" size="sm" onClick={() => widgetActions.ungroupSelected()} disabled={!selectedIds.length}>Ungroup</Button>
      </div>

      <div className="left-card left-card--section left-card-grid layer-scene-card">
        <div className="meta-line meta-line--between meta-line--start">
          <div className="field-stack field-stack--tight content-min-w-0 layer-scene-summary">
            <strong>Scenes</strong>
            <small className="muted">Select a scene to inspect its hierarchy here.</small>
          </div>
          <span className="pill">{scenes.length}</span>
        </div>
        <div className="field-stack">
          {scenes.map((sceneItem, index) => {
            const isActiveScene = sceneItem.id === activeSceneId;
            return (
              <SurfaceButton
                key={sceneItem.id}
                layout="stack"
                isActive={isActiveScene}
                className={`left-button layer-scene-row ${isActiveScene ? 'is-active' : ''}`}
                onClick={() => sceneActions.selectScene(sceneItem.id)}
              >
                <div className="meta-line meta-line--between meta-line--start">
                  <strong>{index + 1}. {sceneItem.name}</strong>
                  <span className="pill">{sceneItem.widgetIds.length}</span>
                </div>
                <small className="muted">{isActiveScene ? 'Active scene' : 'Switch to inspect layers'}</small>
              </SurfaceButton>
            );
          })}
        </div>
      </div>

      <div className="left-card left-card--section left-card-grid layer-scene-card">
        <div className="meta-line meta-line--between meta-line--start">
          <div className="field-stack field-stack--tight content-min-w-0 layer-scene-summary">
            <strong>{scene.name}</strong>
            <small className="muted">{visibleLayerIds.length} visible rows in the outline</small>
          </div>
          <span className="pill">{scene.widgetIds.length} layers</span>
        </div>
        {outline.length ? (
          <div ref={layerScrollRef} className="left-rail-virtual-scroll left-rail-virtual-scroll--layers">
            <div ref={layerTreeRef} className="layer-outline-tree virtual-window-pad">
              {virtualLayers.visibleItems.map(({ item }) => renderLayerItem(item))}
            </div>
          </div>
        ) : (
          <small className="muted">This scene has no layers yet. Add widgets from the library to start building the outline.</small>
        )}
        {selectedWidgets.length ? (
          <div className="field-stack">
            <small className="muted">Selection summary</small>
            {selectedWidgets.map((widget) => (
              <div key={widget.id} className="layer-row compact">
                <div className="layer-meta">
                  <strong>{widget.name}</strong>
                  <small className="muted">{widget.hidden ? 'Hidden' : 'Visible'} · {widget.locked ? 'Locked' : 'Unlocked'}</small>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

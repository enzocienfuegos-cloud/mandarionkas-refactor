import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { ZOOM_MAX, ZOOM_MIN } from '../controllers/stage-viewport';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';

type StageFloatingToolbarProps = {
  toolbarRef: MutableRefObject<HTMLDivElement | null>;
  toolbarCollapsed: boolean;
  toolbarStyle: CSSProperties;
  sceneName: string;
  stageBackdrop: 'light' | 'gray' | 'dark';
  showStageRulers: boolean;
  showWidgetBadges: boolean;
  zoom: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleCollapsed: () => void;
  onPreviousScene: () => void;
  onNextScene: () => void;
  onToggleRulers: () => void;
  onToggleWidgetBadges: () => void;
  onSetBackdrop: (tone: 'light' | 'gray' | 'dark') => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitToViewport: () => void;
};

export function StageFloatingToolbar({
  toolbarRef,
  toolbarCollapsed,
  toolbarStyle,
  sceneName,
  stageBackdrop,
  showStageRulers,
  showWidgetBadges,
  zoom,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onToggleCollapsed,
  onPreviousScene,
  onNextScene,
  onToggleRulers,
  onToggleWidgetBadges,
  onSetBackdrop,
  onZoomOut,
  onZoomIn,
  onFitToViewport,
}: StageFloatingToolbarProps): JSX.Element {
  return (
    <div
      ref={toolbarRef}
      className={`workspace-toolbar workspace-toolbar--ux workspace-toolbar--floating ${toolbarCollapsed ? 'is-collapsed' : ''}`}
      {...createStageInteractionProps(STAGE_INTERACTION.floatingToolbar)}
      style={toolbarStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="workspace-toolbar-drag-handle"
        title="Move stage controls"
        {...createStageInteractionProps(STAGE_INTERACTION.toolbarDragHandle)}
      >
        ⋮⋮
      </div>
      <button className="ghost" title={toolbarCollapsed ? 'Expand controls' : 'Collapse controls'} onClick={onToggleCollapsed}>{toolbarCollapsed ? '▣' : '—'}</button>
      {!toolbarCollapsed ? (
        <>
          <button className="ghost" onClick={onPreviousScene}>←</button>
          <span className="pill">Scene: {sceneName}</span>
          <button className="ghost" onClick={onNextScene}>→</button>
          <button className={`ghost ${showStageRulers ? 'is-active' : ''}`} onClick={onToggleRulers}>Rulers</button>
          <button className={`ghost ${showWidgetBadges ? 'is-active' : ''}`} onClick={onToggleWidgetBadges}>Badges</button>
          <div className="stage-backdrop-switch" aria-label="Canvas preview background">
            {(['light', 'gray', 'dark'] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                className={`stage-backdrop-swatch ${stageBackdrop === tone ? 'is-active' : ''}`}
                data-tone={tone}
                aria-label={`Use ${tone} workspace background`}
                title={`Workspace background: ${tone}`}
                onClick={() => onSetBackdrop(tone)}
              />
            ))}
          </div>
          <button className="ghost" onClick={onZoomOut} disabled={zoom <= ZOOM_MIN}>-</button>
          <span className="pill">{Math.round(zoom * 100)}%</span>
          <button className="ghost" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX}>+</button>
          <button className="ghost" onClick={onFitToViewport}>Fit</button>
        </>
      ) : (
        <>
          <span className="pill">Stage</span>
          <button className={`ghost ${showStageRulers ? 'is-active' : ''}`} onClick={onToggleRulers}>R</button>
          <button className={`ghost ${showWidgetBadges ? 'is-active' : ''}`} onClick={onToggleWidgetBadges}>B</button>
        </>
      )}
    </div>
  );
}

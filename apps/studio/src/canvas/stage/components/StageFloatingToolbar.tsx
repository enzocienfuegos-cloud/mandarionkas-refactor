import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { ZOOM_MAX, ZOOM_MIN } from '../controllers/stage-viewport';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Tooltip } from '../../../shared/ui/Tooltip';

type StageFloatingToolbarProps = {
  toolbarRef: MutableRefObject<HTMLDivElement | null>;
  toolbarCollapsed: boolean;
  toolbarStyle: CSSProperties;
  sceneName: string;
  stageBackdrop: 'light' | 'gray' | 'dark';
  showStageRulers: boolean;
  showWidgetBadges: boolean;
  editModeWireframe: boolean;
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
  onToggleWireframe: () => void;
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
  editModeWireframe,
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
  onToggleWireframe,
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
      <Tooltip content="Move stage controls">
        <div
          className="workspace-toolbar-drag-handle"
          {...createStageInteractionProps(STAGE_INTERACTION.toolbarDragHandle)}
          tabIndex={0}
          aria-label="Move stage controls"
        >
          <StudioIcon icon={StudioIcons.gripVertical} size={16} />
        </div>
      </Tooltip>
      <Tooltip content={toolbarCollapsed ? 'Expand controls' : 'Collapse controls'}>
        <button className="ghost" onClick={onToggleCollapsed} aria-label={toolbarCollapsed ? 'Expand controls' : 'Collapse controls'}>
          <StudioIcon icon={toolbarCollapsed ? StudioIcons.maximize : StudioIcons.minus} size={16} />
        </button>
      </Tooltip>
      {!toolbarCollapsed ? (
        <>
          <Tooltip content="Previous scene">
            <button className="ghost" onClick={onPreviousScene} aria-label="Previous scene">
              <StudioIcon icon={StudioIcons.arrowLeft} size={16} />
            </button>
          </Tooltip>
          <span className="pill">Scene: {sceneName}</span>
          <Tooltip content="Next scene">
            <button className="ghost" onClick={onNextScene} aria-label="Next scene">
              <StudioIcon icon={StudioIcons.arrowRight} size={16} />
            </button>
          </Tooltip>
          <button className={`ghost ${showStageRulers ? 'is-active' : ''}`} onClick={onToggleRulers}>
            <StudioIcon icon={StudioIcons.ruler} size={16} />
            {' '}
            Rulers
          </button>
          <button className={`ghost ${showWidgetBadges ? 'is-active' : ''}`} onClick={onToggleWidgetBadges}>
            <StudioIcon icon={StudioIcons.tag} size={16} />
            {' '}
            Badges
          </button>
          <Tooltip content="Toggle wireframe mode (W)">
            <button className={`ghost ${editModeWireframe ? 'is-active' : ''}`} onClick={onToggleWireframe} aria-label="Toggle wireframe mode">
              <StudioIcon icon={StudioIcons.boxes} size={16} />
              {' '}
              Wireframe
            </button>
          </Tooltip>
          <div className="stage-backdrop-switch" aria-label="Canvas preview background">
            {(['light', 'gray', 'dark'] as const).map((tone) => (
              <Tooltip key={tone} content={`Workspace background: ${tone}`}>
                <button
                  type="button"
                  className={`stage-backdrop-swatch ${stageBackdrop === tone ? 'is-active' : ''}`}
                  data-tone={tone}
                  aria-label={`Use ${tone} workspace background`}
                  onClick={() => onSetBackdrop(tone)}
                />
              </Tooltip>
            ))}
          </div>
          <Tooltip content="Zoom out">
            <button className="ghost" onClick={onZoomOut} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
              <StudioIcon icon={StudioIcons.minus} size={16} />
            </button>
          </Tooltip>
          <span className="pill">{Math.round(zoom * 100)}%</span>
          <Tooltip content="Zoom in">
            <button className="ghost" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
              <StudioIcon icon={StudioIcons.plus} size={16} />
            </button>
          </Tooltip>
          <button className="ghost" onClick={onFitToViewport}>
            <StudioIcon icon={StudioIcons.scanSearch} size={16} />
            {' '}
            Fit
          </button>
        </>
      ) : (
        <>
          <span className="pill">Stage</span>
          <Tooltip content="Toggle rulers">
            <button className={`ghost ${showStageRulers ? 'is-active' : ''}`} onClick={onToggleRulers} aria-label="Toggle rulers">
              <StudioIcon icon={StudioIcons.ruler} size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Toggle badges">
            <button className={`ghost ${showWidgetBadges ? 'is-active' : ''}`} onClick={onToggleWidgetBadges} aria-label="Toggle badges">
              <StudioIcon icon={StudioIcons.tag} size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Toggle wireframe mode (W)">
            <button className={`ghost ${editModeWireframe ? 'is-active' : ''}`} onClick={onToggleWireframe} aria-label="Toggle wireframe mode">
              <StudioIcon icon={StudioIcons.boxes} size={16} />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
}

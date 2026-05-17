import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { ZOOM_MAX, ZOOM_MIN } from '../controllers/stage-viewport';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Tooltip } from '../../../shared/ui/Tooltip';

type StageFloatingToolbarProps = {
  toolbarRef: MutableRefObject<HTMLDivElement | null>;
  toolbarCollapsed: boolean;
  toolbarStyle: CSSProperties;
  sceneName: string;
  previewMode: boolean;
  stageBackdrop: 'light' | 'gray' | 'dark';
  showStageRulers: boolean;
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
  onToggleWireframe: () => void;
  onSetBackdrop: (tone: 'light' | 'gray' | 'dark') => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFitToViewport: () => void;
  onResetInteractions: () => void;
};

export function StageFloatingToolbar({
  toolbarRef,
  toolbarCollapsed,
  toolbarStyle,
  sceneName,
  previewMode,
  stageBackdrop,
  showStageRulers,
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
  onToggleWireframe,
  onSetBackdrop,
  onZoomOut,
  onZoomIn,
  onFitToViewport,
  onResetInteractions,
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
      <IconButton
        label={toolbarCollapsed ? 'Expand controls' : 'Collapse controls'}
        icon={<StudioIcon icon={toolbarCollapsed ? StudioIcons.maximize : StudioIcons.minus} size={16} />}
        onClick={onToggleCollapsed}
      />
      {!toolbarCollapsed ? (
        <>
          <IconButton
            label="Previous scene"
            icon={<StudioIcon icon={StudioIcons.arrowLeft} size={16} />}
            onClick={onPreviousScene}
          />
          <span className="pill">Scene: {sceneName}</span>
          <IconButton
            label="Next scene"
            icon={<StudioIcon icon={StudioIcons.arrowRight} size={16} />}
            onClick={onNextScene}
          />
          <Button variant="ghost" size="sm" className={showStageRulers ? 'is-active' : ''} aria-pressed={showStageRulers} iconBefore={<StudioIcon icon={StudioIcons.ruler} size={16} />} onClick={onToggleRulers}>Rulers</Button>
          <Button variant="ghost" size="sm" className={editModeWireframe ? 'is-active' : ''} aria-pressed={editModeWireframe} iconBefore={<StudioIcon icon={StudioIcons.boxes} size={16} />} onClick={onToggleWireframe}>Wireframe</Button>
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
          <IconButton
            label="Zoom out"
            icon={<StudioIcon icon={StudioIcons.minus} size={16} />}
            onClick={onZoomOut}
            disabled={zoom <= ZOOM_MIN}
          />
          <span className="pill">{Math.round(zoom * 100)}%</span>
          <IconButton
            label="Zoom in"
            icon={<StudioIcon icon={StudioIcons.plus} size={16} />}
            onClick={onZoomIn}
            disabled={zoom >= ZOOM_MAX}
          />
          <Button variant="ghost" size="sm" iconBefore={<StudioIcon icon={StudioIcons.scanSearch} size={16} />} onClick={onFitToViewport}>Fit</Button>
          {previewMode ? (
            <Button variant="ghost" size="sm" iconBefore={<StudioIcon icon={StudioIcons.skipBack} size={16} />} onClick={onResetInteractions}>Reset interactions</Button>
          ) : null}
        </>
      ) : (
        <>
          <span className="pill">Stage</span>
          <IconButton label="Toggle rulers" icon={<StudioIcon icon={StudioIcons.ruler} size={16} />} isActive={showStageRulers} pressed={showStageRulers} onClick={onToggleRulers} />
          <IconButton label="Toggle wireframe mode (W)" icon={<StudioIcon icon={StudioIcons.boxes} size={16} />} isActive={editModeWireframe} pressed={editModeWireframe} onClick={onToggleWireframe} />
          {previewMode ? (
            <IconButton label="Reset interactions" icon={<StudioIcon icon={StudioIcons.skipBack} size={16} />} onClick={onResetInteractions} />
          ) : null}
        </>
      )}
    </div>
  );
}

import { forwardRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { WidgetNode } from '../../../domain/document/types';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { SurfaceButton } from '../../../shared/ui/SurfaceButton';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { getCapability } from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';

type StageSelectionToolbarProps = {
  widget: WidgetNode;
  position: { x: number; y: number };
  uploadDisabled: boolean;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onUploadAsset: () => void;
  onOpenAssetLibrary: () => void;
  onDelete: () => void;
};

type IconButtonProps = {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  placeholder?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function IconButton({ label, danger = false, disabled = false, placeholder = false, onClick, children }: IconButtonProps): JSX.Element {
  const button = (
    <SurfaceButton
      variant={danger ? 'danger' : 'ghost'}
      size="sm"
      className={`icon-only${danger ? ' danger' : ''}${placeholder ? ' is-placeholder' : ''}`}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      tabIndex={placeholder ? -1 : 0}
      aria-hidden={placeholder || undefined}
    >
      {children}
    </SurfaceButton>
  );

  if (placeholder) {
    return button;
  }

  return (
    <Tooltip content={label}>
      {button}
    </Tooltip>
  );
}

function PlaceholderIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12" />
    </svg>
  );
}

function supportsMediaAssetLibrary(widget: WidgetNode): boolean {
  const definition = getWidgetDefinition(widget.type);
  return Boolean(getCapability(definition, 'acceptsImageAsset') || getCapability(definition, 'acceptsVideoAsset'));
}

export const StageSelectionToolbar = forwardRef<HTMLDivElement, StageSelectionToolbarProps>(function StageSelectionToolbar({
  widget,
  position,
  uploadDisabled,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onMoveBackward,
  onMoveForward,
  onUploadAsset,
  onOpenAssetLibrary,
  onDelete,
}, ref): JSX.Element {
  const style = {
    left: Math.round(position.x),
    top: Math.round(position.y),
    '--selection-toolbar-pill-width': '140px',
  } as CSSProperties;

  const stopPropagation = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };
  const definition = getWidgetDefinition(widget.type);
  const acceptsVideoAsset = Boolean(getCapability(definition, 'acceptsVideoAsset'));
  const widgetSummary = `${Math.round(widget.frame.width)}×${Math.round(widget.frame.height)}`;

  return (
    <div
      ref={ref}
      className="stage-selection-toolbar workspace-toolbar workspace-toolbar--ux selection-mini-toolbar"
      style={style}
      onPointerDown={stopPropagation}
      {...createStageInteractionProps(STAGE_INTERACTION.selectionToolbar)}
    >
      <div className="stage-selection-summary" title={definition.renderLabel(widget)}>
        <strong className="stage-selection-title">{widget.name}</strong>
        <span className="pill stage-selection-pill">{definition.label}</span>
        <small className="stage-selection-meta">{widgetSummary}</small>
      </div>
      <IconButton label={widget.hidden ? 'Show widget' : 'Hide widget'} onClick={onToggleVisibility}>
        <StudioIcon icon={widget.hidden ? StudioIcons.eyeOff : StudioIcons.eye} size={14} />
      </IconButton>
      <IconButton label={widget.locked ? 'Unlock widget' : 'Lock widget'} onClick={onToggleLock}>
        <StudioIcon icon={widget.locked ? StudioIcons.lock : StudioIcons.lockOpen} size={14} />
      </IconButton>
      {supportsMediaAssetLibrary(widget) ? (
        <>
          <IconButton label={acceptsVideoAsset ? 'Replace video from library' : 'Replace image from library'} disabled={uploadDisabled} onClick={onUploadAsset}>
            <StudioIcon icon={StudioIcons.upload} size={14} />
          </IconButton>
          <IconButton label="Open asset library" onClick={onOpenAssetLibrary}>
            <StudioIcon icon={StudioIcons.library} size={14} />
          </IconButton>
        </>
      ) : (
        <>
          <IconButton label="" placeholder onClick={() => {}}>
            <PlaceholderIcon />
          </IconButton>
          <IconButton label="" placeholder onClick={() => {}}>
            <PlaceholderIcon />
          </IconButton>
        </>
      )}
      <IconButton label="Send layer backward" onClick={onMoveBackward}>
        <StudioIcon icon={StudioIcons.arrowDownToLine} size={14} />
      </IconButton>
      <IconButton label="Duplicate widget" onClick={onDuplicate}>
        <StudioIcon icon={StudioIcons.copy} size={14} />
      </IconButton>
      <IconButton label="Bring layer forward" onClick={onMoveForward}>
        <StudioIcon icon={StudioIcons.arrowUpToLine} size={14} />
      </IconButton>
      <IconButton label="Delete widget" danger onClick={onDelete}>
        <StudioIcon icon={StudioIcons.trash} size={14} />
      </IconButton>
    </div>
  );
});

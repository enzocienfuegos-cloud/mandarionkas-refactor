import { forwardRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { WidgetNode } from '../../../domain/document/types';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { SurfaceButton } from '../../../shared/ui/SurfaceButton';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { getCapability } from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import { widgetAcceptsAssetSwap } from '../../../app/shell/left-rail/asset-controller-helpers';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';

type StageSelectionToolbarProps = {
  widget: WidgetNode;
  position: { x: number; y: number };
  uploadDisabled: boolean;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onUngroup: () => void;
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

function supportsMediaAssetLibrary(widget: WidgetNode): boolean {
  return widgetAcceptsAssetSwap(widget);
}

export const StageSelectionToolbar = forwardRef<HTMLDivElement, StageSelectionToolbarProps>(function StageSelectionToolbar({
  widget,
  position,
  uploadDisabled,
  onToggleVisibility,
  onToggleLock,
  onUngroup,
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
  } as CSSProperties;

  const stopPropagation = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };
  const definition = getWidgetDefinition(widget.type);
  const acceptsVideoAsset = Boolean(getCapability(definition, 'acceptsVideoAsset'));
  const canUngroup = Boolean(widget.parentId || getCapability(definition, 'isContainer'));

  return (
    <div
      ref={ref}
      className="stage-selection-toolbar workspace-toolbar workspace-toolbar--ux selection-mini-toolbar"
      style={style}
      onPointerDown={stopPropagation}
      {...createStageInteractionProps(STAGE_INTERACTION.selectionToolbar)}
    >
      <IconButton label={widget.hidden ? 'Show widget' : 'Hide widget'} onClick={onToggleVisibility}>
        <StudioIcon icon={widget.hidden ? StudioIcons.eyeOff : StudioIcons.eye} size={14} />
      </IconButton>
      <IconButton label={widget.locked ? 'Unlock widget' : 'Lock widget'} onClick={onToggleLock}>
        <StudioIcon icon={widget.locked ? StudioIcons.lock : StudioIcons.lockOpen} size={14} />
      </IconButton>
      {canUngroup ? (
        <IconButton label="Ungroup selection" onClick={onUngroup}>
          <StudioIcon icon={StudioIcons.layers} size={14} />
        </IconButton>
      ) : null}
      {supportsMediaAssetLibrary(widget) ? (
        <>
          <IconButton label={acceptsVideoAsset ? 'Replace video from library' : 'Replace image from library'} disabled={uploadDisabled} onClick={onUploadAsset}>
            <StudioIcon icon={StudioIcons.upload} size={14} />
          </IconButton>
          <IconButton label="Open asset library" onClick={onOpenAssetLibrary}>
            <StudioIcon icon={StudioIcons.library} size={14} />
          </IconButton>
        </>
      ) : null}
      <IconButton label="Send layer to back" onClick={onMoveBackward}>
        <StudioIcon icon={StudioIcons.arrowDownToLine} size={14} />
      </IconButton>
      <IconButton label="Duplicate widget" onClick={onDuplicate}>
        <StudioIcon icon={StudioIcons.copy} size={14} />
      </IconButton>
      <IconButton label="Bring layer to front" onClick={onMoveForward}>
        <StudioIcon icon={StudioIcons.arrowUpToLine} size={14} />
      </IconButton>
      <IconButton label="Delete widget" danger onClick={onDelete}>
        <StudioIcon icon={StudioIcons.trash} size={14} />
      </IconButton>
    </div>
  );
});

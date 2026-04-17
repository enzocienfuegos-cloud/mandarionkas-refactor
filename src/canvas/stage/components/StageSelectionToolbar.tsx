import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { WidgetNode } from '../../../domain/document/types';

type StageSelectionToolbarProps = {
  widget: WidgetNode;
  position: { x: number; y: number };
  uploadDisabled: boolean;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
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
  children: JSX.Element;
};

function IconButton({ label, danger = false, disabled = false, placeholder = false, onClick, children }: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`ghost icon-only${danger ? ' danger' : ''}${placeholder ? ' is-placeholder' : ''}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      tabIndex={placeholder ? -1 : 0}
      aria-hidden={placeholder || undefined}
    >
      {children}
    </button>
  );
}

function EyeIcon({ closed }: { closed: boolean }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.6 12c2.3-3.7 5.7-5.5 9.4-5.5s7.1 1.8 9.4 5.5c-2.3 3.7-5.7 5.5-9.4 5.5S4.9 15.7 2.6 12Z" />
      <circle cx="12" cy="12" r="3.2" />
      {closed ? <path d="M4 4 20 20" /> : null}
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }): JSX.Element {
  return locked ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10V8a5 5 0 0 1 10 0v2" />
      <rect x="5" y="10" width="14" height="10" rx="2" ry="2" />
      <circle cx="12" cy="15" r="1.2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 10V8a4 4 0 0 1 7.7-1.5" />
      <path d="M17 10h-9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="15" r="1.2" />
    </svg>
  );
}

function UploadIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V5" />
      <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function LibraryIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="4" height="14" rx="1" />
      <rect x="10" y="5" width="4" height="14" rx="1" />
      <rect x="16" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function LayerDownIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m6 13 6 3 6-3" />
      <path d="m10 18 2 2 2-2" />
    </svg>
  );
}

function LayerUpIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m6 14 6 3 6-3" />
      <path d="m10 7 2-2 2 2" />
    </svg>
  );
}

function DeleteIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7v11h8V7" />
      <path d="M10 10v5" />
      <path d="M14 10v5" />
    </svg>
  );
}

function PlaceholderIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12" />
    </svg>
  );
}

function isMediaWidget(widget: WidgetNode): boolean {
  return widget.type === 'image' || widget.type === 'hero-image' || widget.type === 'video-hero';
}

export function StageSelectionToolbar({
  widget,
  position,
  uploadDisabled,
  onToggleVisibility,
  onToggleLock,
  onMoveBackward,
  onMoveForward,
  onUploadAsset,
  onOpenAssetLibrary,
  onDelete,
}: StageSelectionToolbarProps): JSX.Element {
  const style = {
    left: position.x,
    top: position.y,
    '--selection-toolbar-pill-width': '88px',
  } as CSSProperties;

  const stopPropagation = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="stage-selection-toolbar workspace-toolbar workspace-toolbar--ux selection-mini-toolbar" style={style} onPointerDown={stopPropagation}>
      <span className="pill stage-selection-pill">{widget.type}</span>
      <IconButton label={widget.hidden ? 'Show widget' : 'Hide widget'} onClick={onToggleVisibility}>
        <EyeIcon closed={Boolean(widget.hidden)} />
      </IconButton>
      <IconButton label={widget.locked ? 'Unlock widget' : 'Lock widget'} onClick={onToggleLock}>
        <LockIcon locked={Boolean(widget.locked)} />
      </IconButton>
      {isMediaWidget(widget) ? (
        <>
          <IconButton label={widget.type === 'video-hero' ? 'Replace video from library' : 'Replace image from library'} disabled={uploadDisabled} onClick={onUploadAsset}>
            <UploadIcon />
          </IconButton>
          <IconButton label="Open asset library" onClick={onOpenAssetLibrary}>
            <LibraryIcon />
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
        <LayerDownIcon />
      </IconButton>
      <IconButton label="Bring layer forward" onClick={onMoveForward}>
        <LayerUpIcon />
      </IconButton>
      <IconButton label="Delete widget" danger onClick={onDelete}>
        <DeleteIcon />
      </IconButton>
    </div>
  );
}

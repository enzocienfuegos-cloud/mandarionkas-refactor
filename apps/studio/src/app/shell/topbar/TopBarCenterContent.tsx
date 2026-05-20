import { useEffect, useRef, useState } from 'react';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { useToast } from '../../../shared/ui/ToastProvider';
import { buildClientPreviewToken, buildClientPreviewUrl, persistClientPreviewSnapshotWithAssets } from '../../../features/client-preview/project-loader';
import type { TopBarController } from './use-top-bar-controller';
import { PreviewLaunchModal } from './PreviewLaunchModal';

function clampZoom(value: number): number {
  return Math.max(0.25, Math.min(2, Number(value.toFixed(2))));
}

function fitZoomForWorkspace(args: {
  canvas: { width: number; height: number };
}): number {
  const { canvas } = args;
  const workspace = document.querySelector('.workspace-shell');
  if (!(workspace instanceof HTMLDivElement)) return 1;
  const bounds = workspace.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return 1;
  return clampZoom(Math.min(
    Math.max(0.25, (Math.max(1, bounds.width - 96) / canvas.width)),
    Math.max(0.25, (Math.max(1, bounds.height - 96) / canvas.height)),
    1,
  ));
}

export function TopBarCenterContent({
  controller,
}: {
  controller: TopBarController;
}): JSX.Element {
  const { previewMode, zoom, state, editModeWireframe } = controller.snapshot;
  const { documentActions, uiActions } = controller.document;
  const { canvas } = state.document;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [previewLauncherOpen, setPreviewLauncherOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const { pushToast } = useToast();
  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const projectId = controller.snapshot.activeProjectId ?? state.document.id;
  const previewToken = buildClientPreviewToken(projectId, state.document.version);
  const previewUrl = typeof window !== 'undefined'
    ? buildClientPreviewUrl(window.location, projectId, previewToken)
    : '';

  useEffect(() => {
    if (!overflowOpen) return undefined;

    function handleMouseDown(event: MouseEvent): void {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOverflowOpen(false);
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [overflowOpen]);

  function zoomBy(delta: number): void {
    uiActions.setZoom(clampZoom(zoom + delta));
  }

  function fitToScreen(): void {
    uiActions.setZoom(fitZoomForWorkspace({ canvas }));
  }

  async function prepareClientPreviewLink(): Promise<string> {
    await persistClientPreviewSnapshotWithAssets(projectId, state);
    documentActions.setShareLink(previewUrl);
    return previewUrl;
  }

  async function copyClientPreviewLink(): Promise<void> {
    const nextPreviewUrl = await prepareClientPreviewLink();
    try {
      await navigator.clipboard?.writeText(nextPreviewUrl);
      pushToast({
        title: 'Preview link copied',
        description: 'The public client preview link is ready to share.',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Unable to copy the preview link.',
        tone: 'danger',
      });
    }
  }

  return (
    <div className="top-center-shell">
      <SegmentedControl
        className="top-mode-toggle"
        ariaLabel="Editor mode"
        value={previewMode ? 'preview' : 'edit'}
        onChange={(value) => {
          if (value === 'edit') {
            setPreviewLauncherOpen(false);
            uiActions.setPreviewMode(false);
            return;
          }
          uiActions.setPreviewMode(true);
        }}
        options={[
          { id: 'edit', label: 'Edit' },
          { id: 'preview', label: 'Preview' },
        ]}
      />

      <Button
        variant="ghost"
        size="sm"
        iconBefore={<StudioIcon icon={StudioIcons.externalLink} size={14} />}
        onClick={() => setPreviewLauncherOpen(true)}
      >
        Share for review
      </Button>

      <div className="top-zoom-control top-center-collapsible">
        <IconButton
          size="sm"
          label="Zoom out"
          tooltipPlacement="bottom"
          icon={<StudioIcon icon={StudioIcons.minus} size={14} />}
          onClick={() => zoomBy(-0.1)}
        />
        <button type="button" className="top-zoom-label" onClick={fitToScreen} aria-label="Fit to screen">
          {zoomLabel}
        </button>
        <IconButton
          size="sm"
          label="Zoom in"
          tooltipPlacement="bottom"
          icon={<StudioIcon icon={StudioIcons.plus} size={14} />}
          onClick={() => zoomBy(0.1)}
        />
      </div>

      <IconButton
        className="top-center-collapsible"
        size="sm"
        label="Toggle wireframe"
        tooltipPlacement="bottom"
        pressed={editModeWireframe}
        isActive={editModeWireframe}
        icon={<StudioIcon icon={StudioIcons.boxes} size={14} />}
        onClick={() => uiActions.setEditModeWireframe(!editModeWireframe)}
      />

      <div ref={overflowRef} className="top-center-overflow">
        <IconButton
          className="top-center-overflow__trigger"
          size="sm"
          label="More view controls"
          tooltipPlacement="bottom"
          icon={<StudioIcon icon={StudioIcons.moreHorizontal} size={14} />}
          onClick={() => setOverflowOpen((current) => !current)}
        />
        {overflowOpen ? (
          <div className="top-center-overflow__menu panel" role="menu" aria-label="More view controls">
            <button type="button" role="menuitem" className="top-overflow-menu-item" onClick={() => { fitToScreen(); setOverflowOpen(false); }}>
              Fit to screen
            </button>
            <button type="button" role="menuitem" className="top-overflow-menu-item" onClick={() => { zoomBy(-0.1); setOverflowOpen(false); }}>
              Zoom out
            </button>
            <button type="button" role="menuitem" className="top-overflow-menu-item" onClick={() => { zoomBy(0.1); setOverflowOpen(false); }}>
              Zoom in
            </button>
            <button
              type="button"
              role="menuitem"
              className="top-overflow-menu-item"
              onClick={() => {
                uiActions.setEditModeWireframe(!editModeWireframe);
                setOverflowOpen(false);
              }}
            >
              {editModeWireframe ? 'Disable wireframe' : 'Enable wireframe'}
            </button>
          </div>
        ) : null}
      </div>

      {previewLauncherOpen ? (
        <PreviewLaunchModal
          previewUrl={previewUrl}
          onClose={() => setPreviewLauncherOpen(false)}
          onOpenClientPreview={() => {
            void prepareClientPreviewLink().then((nextPreviewUrl) => {
              setPreviewLauncherOpen(false);
              window.open(nextPreviewUrl, '_blank', 'noopener,noreferrer');
            });
          }}
          onCopyClientPreviewLink={() => {
            void copyClientPreviewLink();
          }}
        />
      ) : null}
    </div>
  );
}

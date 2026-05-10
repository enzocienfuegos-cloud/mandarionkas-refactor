import { useEffect, useRef, useState } from 'react';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { recordHubProjectActivity } from '../../../platform/agency-shell/activity-api';
import { markProjectExported } from '../../../platform/client-workspace/project-folder-store';
import type { TopBarController } from './use-top-bar-controller';
import { ExportMenu } from './ExportMenu';
import type { ExportChannel } from './export-channels';
import { publishStudioProjectToAdServer } from './studio-publication';
import { useToast } from '../../../shared/ui/ToastProvider';
import { Button } from '../../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';

function openPreflightPanel(): void {
  const toggle = document.querySelector<HTMLButtonElement>('.preflight-tray__toggle');
  toggle?.click();
}

function buildInitials(name?: string): string {
  const parts = (name ?? 'Guest')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return parts.join('') || 'G';
}

function getPreflightSummary(controller: TopBarController): {
  label: string;
  tone: 'ready' | 'warnings' | 'errors';
  count: number;
} {
  const blockers = controller.exportReadiness.preflight.summary.blockers;
  const warnings = controller.exportReadiness.preflight.summary.warnings;
  if (blockers > 0) {
    return { label: 'Errors', tone: 'errors', count: blockers };
  }
  if (warnings > 0) {
    return { label: 'Warnings', tone: 'warnings', count: warnings };
  }
  return { label: 'Ready', tone: 'ready', count: 0 };
}

export function TopBarActions({
  controller,
  onOpenAssetLibrary,
  onOpenBrandKitDrawer,
}: {
  controller: TopBarController;
  onOpenAssetLibrary: () => void;
  onOpenBrandKitDrawer: () => void;
}): JSX.Element {
  const { release, state } = controller.snapshot;
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle');
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const sessionMenuRef = useRef<HTMLDivElement | null>(null);
  const { updateReleaseSettings } = useDocumentActions();
  const { resolvedZipStatus, triggerExportZipBundleResolved, triggerExportPublishPackage } = controller.exportReadiness;
  const activeProjectId = controller.snapshot.activeProjectId;
  const { pushToast } = useToast();
  const shareLink = state.document.collaboration.shareLink ?? `smx://review/${state.document.id}`;
  const currentUser = controller.workspace.currentUser;
  const preflight = getPreflightSummary(controller);

  useEffect(() => {
    if (!sessionMenuOpen) return undefined;

    function handleMouseDown(event: MouseEvent): void {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(event.target as Node)) {
        setSessionMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setSessionMenuOpen(false);
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sessionMenuOpen]);

  async function handleExportAs(channel: ExportChannel): Promise<void> {
    const patchedState = {
      ...state,
      document: {
        ...state.document,
        metadata: {
          ...state.document.metadata,
          release: {
            ...state.document.metadata.release,
            targetChannel: channel,
          },
        },
      },
    };

    updateReleaseSettings({ targetChannel: channel });
    try {
      await triggerExportZipBundleResolved(patchedState);
      if (activeProjectId) {
        markProjectExported(activeProjectId);
        await recordHubProjectActivity(activeProjectId, 'exported', { channel });
      }
      pushToast({
        title: 'Export ready',
        description: `Built ${channel} package successfully.`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unable to build the export package.',
        tone: 'danger',
      });
      throw error;
    }
  }

  async function handleShare(): Promise<void> {
    try {
      await triggerExportPublishPackage(state);
      pushToast({
        title: 'Share package ready',
        description: `Prepared ${release.targetChannel} publish package.`,
        tone: 'success',
      });
      if (activeProjectId) {
        await recordHubProjectActivity(activeProjectId, 'shared', {
          channel: release.targetChannel,
        });
      }
    } catch (error) {
      pushToast({
        title: 'Share failed',
        description: error instanceof Error ? error.message : 'Unable to prepare the share package.',
        tone: 'danger',
      });
      throw error;
    }
  }

  async function handleCopyPreviewLink(): Promise<void> {
    try {
      await navigator.clipboard?.writeText(shareLink);
      pushToast({
        title: 'Preview link copied',
        description: 'The review link is ready to paste.',
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

  async function handlePublishToAdServer(): Promise<void> {
    setPublishStatus('publishing');
    try {
      const publication = await publishStudioProjectToAdServer(state, {
        projectId: activeProjectId,
      });
      setPublishStatus('success');
      if (activeProjectId) {
        await recordHubProjectActivity(activeProjectId, 'shared', {
          channel: release.targetChannel,
          publishTarget: 'ad_server',
          creativeId: publication.creative.id,
          creativeVersionId: publication.creativeVersion.id,
        });
      }
      pushToast({
        title: 'Published to ad server',
        description: `Creative ${publication.creative.id} is ready.`,
        tone: 'success',
      });
    } catch (error) {
      console.error(error);
      setPublishStatus('error');
      pushToast({
        title: 'Publish failed',
        description: error instanceof Error ? error.message : 'Unable to publish this project.',
        tone: 'danger',
      });
    }
  }

  const publishLabel = publishStatus === 'publishing'
    ? 'Publishing…'
    : publishStatus === 'success'
      ? 'Published'
      : 'Publish';

  const preflightLabel = preflight.count > 0 ? `${preflight.label} ${preflight.count}` : preflight.label;

  return (
    <div className="top-actions-cluster">
      <Button
        variant="ghost"
        size="sm"
        className="top-action-button top-action-button--assets"
        iconBefore={<StudioIcon icon={StudioIcons.images} size={14} />}
        onClick={onOpenAssetLibrary}
      >
        Assets
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="top-action-button top-action-button--brand"
        iconBefore={<StudioIcon icon={StudioIcons.palette} size={14} />}
        onClick={onOpenBrandKitDrawer}
      >
        Brand
      </Button>

      <div className="top-bar-divider" aria-hidden="true" />

      <Button
        variant="ghost"
        size="sm"
        className={`top-preflight-button top-preflight-button--${preflight.tone}`.trim()}
        iconBefore={<span className={`top-preflight-dot top-preflight-dot--${preflight.tone}`.trim()} aria-hidden="true" />}
        onClick={openPreflightPanel}
      >
        {preflightLabel}
      </Button>

      <ExportMenu
        currentChannel={release.targetChannel}
        isExporting={resolvedZipStatus === 'exporting'}
        publishLabel={publishLabel}
        onExportAs={(channel) => void handleExportAs(channel)}
        onShare={() => void handleShare()}
        onCopyPreviewLink={() => void handleCopyPreviewLink()}
        onPublish={() => void handlePublishToAdServer()}
      />

      <div ref={sessionMenuRef} className="top-session-menu">
        <button
          type="button"
          className="top-avatar-button"
          aria-label="Open session menu"
          onClick={() => setSessionMenuOpen((current) => !current)}
        >
          {buildInitials(currentUser?.name)}
        </button>
        {sessionMenuOpen ? (
          <div className="top-session-popover panel" role="menu" aria-label="Session menu">
            <div className="top-session-popover__header">
              <strong>{currentUser?.name ?? 'Guest'}</strong>
              <span>{currentUser?.email ?? 'No session email'}</span>
            </div>
            <button
              type="button"
              role="menuitem"
              className="top-session-popover__action"
              onClick={() => {
                setSessionMenuOpen(false);
                controller.workspace.handleLogout();
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

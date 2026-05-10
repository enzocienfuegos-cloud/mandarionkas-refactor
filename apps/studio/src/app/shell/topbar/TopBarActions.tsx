import { useState } from 'react';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { recordHubProjectActivity } from '../../../platform/agency-shell/activity-api';
import type { TopBarController } from './use-top-bar-controller';
import { ExportMenu } from './ExportMenu';
import type { ExportChannel } from './export-channels';
import { publishStudioProjectToAdServer } from './studio-publication';
import { useToast } from '../../../shared/ui/ToastProvider';
import { Button } from '../../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { channelLabel } from './export-channels';

function formatSaveLabel(saveStatus: 'idle' | 'saving' | 'saved' | 'error', dirty: boolean): string {
  if (saveStatus === 'saving') return 'Saving…';
  if (saveStatus === 'saved' && !dirty) return 'Saved';
  if (saveStatus === 'error') return 'Retry save';
  return 'Save';
}

function getExportSummaryIcon(tone: 'danger' | 'good' | 'accent' | 'warn') {
  if (tone === 'danger') return StudioIcons.x;
  if (tone === 'good') return StudioIcons.check;
  if (tone === 'accent') return StudioIcons.workflow;
  return StudioIcons.info;
}

export function TopBarActions({ controller, onOpenBrandKitDrawer }: { controller: TopBarController; onOpenBrandKitDrawer: () => void }): JSX.Element {
  const { release, state, dirty } = controller.snapshot;
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle');
  const { canSaveProjects } = controller.workspace;
  const { updateReleaseSettings } = useDocumentActions();
  const { resolvedZipStatus, resolvedZipMessage, triggerExportZipBundleResolved, triggerExportPublishPackage } = controller.exportReadiness;
  const { handleSaveProject, saveStatus } = controller.projectSession;
  const activeProjectId = controller.snapshot.activeProjectId;
  const { pushToast } = useToast();
  const shareLink = state.document.collaboration.shareLink ?? `smx://review/${state.document.id}`;

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
      pushToast({
        title: 'Export ready',
        description: `Built ${channel} package successfully.`,
        tone: 'success',
      });
      if (activeProjectId) {
        await recordHubProjectActivity(activeProjectId, 'exported', { channel });
      }
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

  async function handleSave(): Promise<void> {
    try {
      await handleSaveProject();
      pushToast({
        title: 'Project saved',
        description: 'The latest changes are now stored in the workspace.',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unable to save this project.',
        tone: 'danger',
      });
    }
  }

  const publishLabel = publishStatus === 'publishing'
    ? 'Publishing…'
    : publishStatus === 'success'
      ? 'Published'
      : 'Publish';
  const saveLabel = formatSaveLabel(saveStatus, dirty);
  const exportTargetLabel = channelLabel(release.targetChannel);
  const packageModeLabel = state.document.canvasVariants.length > 1 ? 'Size set' : 'Single size';
  const exportSummaryTone = resolvedZipStatus === 'error'
    ? 'danger'
    : resolvedZipStatus === 'success'
      ? 'good'
      : resolvedZipStatus === 'exporting'
        ? 'accent'
        : controller.exportReadiness.preflight.summary.readyForBundleZip
          ? 'good'
          : 'warn';
  const exportSummaryTitle = resolvedZipStatus === 'exporting'
    ? 'Building package'
    : resolvedZipStatus === 'success'
      ? 'Package ready'
      : resolvedZipStatus === 'error'
        ? 'Needs attention'
        : controller.exportReadiness.preflight.summary.readyForBundleZip
          ? 'Ready to export'
          : 'Review before export';
  const exportSummaryDetail = resolvedZipMessage ?? controller.exportReadiness.preflight.summary.recommendedNextStep;

  return (
    <div className="top-actions-cluster">
      <div className={`top-actions-summary top-actions-summary--${exportSummaryTone}`.trim()} aria-label="Export readiness summary">
        <span className="top-actions-summary__icon" aria-hidden="true">
          <StudioIcon icon={getExportSummaryIcon(exportSummaryTone)} size={15} />
        </span>
        <div className="top-actions-summary__copy">
          <strong className="top-actions-summary__title">{exportSummaryTitle}</strong>
          <small className="top-actions-summary__eyebrow">{exportTargetLabel} · {packageModeLabel}</small>
        </div>
        <small className="top-actions-summary__detail">{exportSummaryDetail}</small>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="top-brand-kit-button"
        iconBefore={<StudioIcon icon={StudioIcons.tags} size={14} />}
        onClick={onOpenBrandKitDrawer}
      >
        Brand Kit
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

      <Button
        variant="primary"
        size="sm"
        className="top-save-button"
        onClick={() => void handleSave()}
        disabled={!canSaveProjects || saveStatus === 'saving'}
      >
        {saveLabel}
      </Button>
    </div>
  );
}

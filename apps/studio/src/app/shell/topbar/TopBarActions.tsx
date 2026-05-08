import { useState } from 'react';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { recordHubProjectActivity } from '../../../platform/agency-shell/activity-api';
import type { TopBarController } from './use-top-bar-controller';
import { ExportMenu } from './ExportMenu';
import type { ExportChannel } from './export-channels';
import { publishStudioProjectToAdServer } from './studio-publication';
import { StatusChip } from '../StatusChip';
import { useToast } from '../../../shared/ui/ToastProvider';

export function TopBarActions({ controller }: { controller: TopBarController }): JSX.Element {
  const { previewMode, release, state } = controller.snapshot;
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle');
  const { uiActions } = controller.document;
  const { canSaveProjects } = controller.workspace;
  const { updateReleaseSettings } = useDocumentActions();
  const { resolvedZipStatus, triggerExportZipBundleResolved, triggerExportPublishPackage } = controller.exportReadiness;
  const { handleSaveProject, saveStatus } = controller.projectSession;
  const activeProjectId = controller.snapshot.activeProjectId;
  const { pushToast } = useToast();

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

  return (
    <div className="top-actions-cluster">
      <button
        type="button"
        className={`ghost compact-action${previewMode ? ' is-active' : ''}`}
        aria-pressed={previewMode}
        onClick={() => uiActions.setPreviewMode(!previewMode)}
      >
        {previewMode ? 'Exit Preview' : 'Preview'}
      </button>

      <ExportMenu
        currentChannel={release.targetChannel}
        isExporting={resolvedZipStatus === 'exporting'}
        onExportAs={(channel) => void handleExportAs(channel)}
      />

      <button type="button" className="ghost compact-action" onClick={() => void handleShare()}>
        Share
      </button>

      <button
        type="button"
        className="ghost compact-action"
        onClick={() => void handlePublishToAdServer()}
        disabled={publishStatus === 'publishing'}
      >
        {publishLabel}
      </button>

      <button
        type="button"
        className="primary compact-action top-save-button"
        onClick={() => void handleSave()}
        disabled={!canSaveProjects || saveStatus === 'saving'}
      >
        {saveStatus === 'saving' ? 'Saving…' : 'Save'}
      </button>
      <StatusChip controller={controller} />
    </div>
  );
}

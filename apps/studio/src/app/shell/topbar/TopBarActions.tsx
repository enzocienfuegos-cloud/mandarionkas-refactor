import { useState } from 'react';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { recordHubProjectActivity } from '../../../platform/agency-shell/activity-api';
import type { TopBarController } from './use-top-bar-controller';
import { ExportMenu } from './ExportMenu';
import type { ExportChannel } from './export-channels';
import { publishStudioProjectToAdServer } from './studio-publication';

export function TopBarActions({ controller }: { controller: TopBarController }): JSX.Element {
  const { previewMode, release, state } = controller.snapshot;
  const [publishStatus, setPublishStatus] = useState<'idle' | 'publishing' | 'success' | 'error'>('idle');
  const { uiActions } = controller.document;
  const { canSaveProjects } = controller.workspace;
  const { updateReleaseSettings } = useDocumentActions();
  const { resolvedZipStatus, triggerExportZipBundleResolved, triggerExportPublishPackage } = controller.exportReadiness;
  const { handleSaveProject, saveStatus, saveMessage } = controller.projectSession;
  const activeProjectId = controller.snapshot.activeProjectId;

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
    await triggerExportZipBundleResolved(patchedState);
    if (activeProjectId) {
      await recordHubProjectActivity(activeProjectId, 'exported', { channel });
    }
  }

  async function handleShare(): Promise<void> {
    await triggerExportPublishPackage(state);
    if (activeProjectId) {
      await recordHubProjectActivity(activeProjectId, 'shared', {
        channel: release.targetChannel,
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
    } catch (error) {
      console.error(error);
      setPublishStatus('error');
    }
  }

  const saveIndicatorClass = `top-save-dot top-save-dot--${saveStatus}`;
  const saveTitle =
    saveStatus === 'error'
      ? (saveMessage ?? 'Save failed')
      : saveStatus === 'saving'
        ? 'Saving…'
        : saveStatus === 'saved'
          ? (saveMessage ?? 'Saved')
          : 'Changes not saved';
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
        onClick={() => void handleSaveProject()}
        disabled={!canSaveProjects || saveStatus === 'saving'}
      >
        {saveStatus === 'saving' ? 'Saving…' : 'Save'}
      </button>

      <span className={saveIndicatorClass} title={saveTitle} aria-label={saveTitle} aria-live="polite" />
    </div>
  );
}

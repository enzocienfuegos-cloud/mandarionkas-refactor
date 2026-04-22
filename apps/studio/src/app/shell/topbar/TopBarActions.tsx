import { useDocumentActions } from '../../../hooks/use-studio-actions';
import type { TopBarController } from './use-top-bar-controller';
import { ExportMenu } from './ExportMenu';
import type { ExportChannel } from './export-channels';

export function TopBarActions({ controller }: { controller: TopBarController }): JSX.Element {
  const { previewMode, release, state } = controller.snapshot;
  const { uiActions } = controller.document;
  const { canSaveProjects } = controller.workspace;
  const { updateReleaseSettings } = useDocumentActions();
  const { resolvedZipStatus, triggerExportZipBundleResolved, triggerExportPublishPackage } = controller.exportReadiness;
  const { handleSaveProject, saveStatus, saveMessage } = controller.projectSession;

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
  }

  function handleShare(): void {
    triggerExportPublishPackage(state);
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

      <button type="button" className="ghost compact-action" onClick={handleShare}>
        Share
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

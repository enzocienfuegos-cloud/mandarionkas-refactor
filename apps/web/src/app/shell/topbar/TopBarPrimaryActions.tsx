import type { TopBarController } from './use-top-bar-controller';
import { useDocumentActions } from '../../../hooks/use-studio-actions';

function channelLabel(target: TopBarController['snapshot']['release']['targetChannel']): string {
  switch (target) {
    case 'mraid':
      return 'MRAID';
    case 'gam-html5':
      return 'GAM HTML5';
    case 'google-display':
      return 'Google Display';
    case 'meta-story':
      return 'Meta Story';
    case 'tiktok-vertical':
      return 'TikTok Vertical';
    case 'generic-html5':
    default:
      return 'IAB HTML5';
  }
}

function statusLabel(controller: TopBarController): string {
  const { dirty, lastSavedAt } = controller.snapshot;
  const { saveStatus, saveMessage } = controller.projectSession;
  if (saveStatus === 'saving') return 'Saving…';
  if (saveStatus === 'error') return saveMessage ?? 'Save failed';
  if (saveStatus === 'saved') return saveMessage ?? 'Saved';
  if (dirty) return 'Unsaved changes';
  if (lastSavedAt) return `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`;
  return 'Ready';
}

export function TopBarPrimaryActions({ controller }: { controller: TopBarController }): JSX.Element {
  const { canSaveProjects } = controller.workspace;
  const { previewMode, release } = controller.snapshot;
  const { uiActions } = controller.document;
  const { updateReleaseSettings } = useDocumentActions();
  const { handleSaveProject, handleSaveVersion, saveStatus } = controller.projectSession;
  const { preflight, resolvedZipStatus, triggerExportPreflight, triggerExportZipBundleResolved } = controller.exportReadiness;
  const label = statusLabel(controller);
  const resolvedBlocked = !preflight.summary.readyForBundleZip || resolvedZipStatus === 'exporting';
  const exportTargetLabel = channelLabel(release.targetChannel);

  return (
    <div className="top-actions-cluster">
      <select
        className="ghost compact-action"
        value={release.targetChannel}
        onChange={(event) => updateReleaseSettings({ targetChannel: event.target.value as typeof release.targetChannel })}
        aria-label="Export target"
        title="Export target"
      >
        <option value="generic-html5">IAB HTML5</option>
        <option value="google-display">Google Display</option>
        <option value="gam-html5">GAM HTML5</option>
        <option value="mraid">MRAID</option>
        <option value="meta-story">Meta Story</option>
        <option value="tiktok-vertical">TikTok Vertical</option>
      </select>
      <button
        className="ghost compact-action"
        type="button"
        onClick={() => triggerExportPreflight(controller.snapshot.state)}
        title={preflight.summary.recommendedNextStep}
      >
        {exportTargetLabel} · {preflight.summary.packageGrade}
      </button>
      <button
        className="ghost compact-action"
        type="button"
        onClick={() => void triggerExportZipBundleResolved(controller.snapshot.state)}
        disabled={resolvedBlocked}
        title={resolvedBlocked ? preflight.summary.recommendedNextStep : `Export ${exportTargetLabel} ZIP`}
      >
        {resolvedZipStatus === 'exporting' ? `Exporting ${exportTargetLabel}…` : `Export ${exportTargetLabel}`}
      </button>
      <div className={`top-save-indicator top-save-indicator--${saveStatus}`}>{label}</div>
      <button className="ghost compact-action" type="button" onClick={() => uiActions.setPreviewMode(!previewMode)}>
        {previewMode ? 'Exit preview' : 'Preview'}
      </button>
      <button className="ghost compact-action" type="button" onClick={() => void handleSaveVersion()} disabled={!canSaveProjects || saveStatus === 'saving'}>
        Save version
      </button>
      <button className="primary compact-action top-save-button" type="button" onClick={() => void handleSaveProject()} disabled={!canSaveProjects || saveStatus === 'saving'}>
        {saveStatus === 'saving' ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

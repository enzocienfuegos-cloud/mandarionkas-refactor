import type { TopBarController } from './use-top-bar-controller';

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
  const { previewMode } = controller.snapshot;
  const { uiActions } = controller.document;
  const { handleSaveProject, handleSaveVersion, saveStatus } = controller.projectSession;
  const { preflight, resolvedZipStatus, triggerExportPreflight, triggerExportZipBundleResolved } = controller.exportReadiness;
  const label = statusLabel(controller);
  const resolvedBlocked = !preflight.summary.readyForBundleZip || resolvedZipStatus === 'exporting';

  return (
    <div className="top-actions-cluster">
      <button
        className="ghost compact-action"
        type="button"
        onClick={() => triggerExportPreflight(controller.snapshot.state)}
        title={preflight.summary.recommendedNextStep}
      >
        Preflight · {preflight.summary.packageGrade}
      </button>
      <button
        className="ghost compact-action"
        type="button"
        onClick={() => void triggerExportZipBundleResolved(controller.snapshot.state)}
        disabled={resolvedBlocked}
        title={resolvedBlocked ? preflight.summary.recommendedNextStep : 'Export final banner ZIP'}
      >
        {resolvedZipStatus === 'exporting' ? 'Exporting banner…' : 'Export banner'}
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

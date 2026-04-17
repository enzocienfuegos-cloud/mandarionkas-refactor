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
  const label = statusLabel(controller);

  return (
    <div className="top-actions-cluster">
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

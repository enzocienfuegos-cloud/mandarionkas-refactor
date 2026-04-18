import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportReadiness } from '../../../export/engine';
import { useDocumentActions } from '../../../hooks/use-studio-actions';

export function ReleaseSettingsSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const { updateReleaseSettings } = useDocumentActions();
  const release = state.document.metadata.release;
  const readiness = buildExportReadiness(state);

  return (
    <div className="field-stack">
      <div className="field-grid">
        <div>
          <label>Target channel</label>
          <select value={release.targetChannel} onChange={(event) => updateReleaseSettings({ targetChannel: event.target.value as typeof release.targetChannel })}>
            <option value="generic-html5">generic-html5</option>
            <option value="google-display">google-display</option>
            <option value="gam-html5">gam-html5</option>
            <option value="mraid">mraid</option>
            <option value="meta-story">meta-story</option>
            <option value="tiktok-vertical">tiktok-vertical</option>
          </select>
        </div>
        <div>
          <label>QA status</label>
          <select value={release.qaStatus} onChange={(event) => updateReleaseSettings({ qaStatus: event.target.value as typeof release.qaStatus })}>
            <option value="draft">draft</option>
            <option value="ready-for-qa">ready-for-qa</option>
            <option value="qa-passed">qa-passed</option>
          </select>
        </div>
      </div>
      <div>
        <label>Release notes</label>
        <textarea rows={4} value={release.notes ?? ''} onChange={(event) => updateReleaseSettings({ notes: event.target.value })} />
      </div>
      <div className="meta-line">
        <span className="pill">Target {readiness.targetChannel}</span>
        <span className="pill">QA {readiness.qaStatus}</span>
        <span className="pill">Readiness {readiness.score}% · {readiness.grade}</span>
      </div>
    </div>
  );
}

import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportManifest, buildExportReadiness } from '../../../export/engine';
import { listExportChannelProfiles } from '../../../export/adapters';
import { useDocumentActions } from '../../../hooks/use-studio-actions';

export function ReleaseSettingsSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const { updateReleaseSettings } = useDocumentActions();
  const release = state.document.metadata.release;
  const readiness = buildExportReadiness(state);
  const manifest = buildExportManifest(state);
  const channelProfiles = listExportChannelProfiles();
  const isMraid = release.targetChannel === 'mraid';
  const mraidHandoff = manifest.handoff?.mraid;

  return (
    <div className="field-stack">
      <div className="field-grid">
        <div>
          <label>Target channel</label>
          <select value={release.targetChannel} onChange={(event) => updateReleaseSettings({ targetChannel: event.target.value as typeof release.targetChannel })}>
            {channelProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.label}</option>
            ))}
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
        <span className="pill">Target {readiness.channelProfile.label}</span>
        <span className="pill">{readiness.channelProfile.family}</span>
        <span className="pill">{readiness.channelProfile.deliveryMode}</span>
        <span className="pill">QA {readiness.qaStatus}</span>
        <span className="pill">Readiness {readiness.score}% · {readiness.grade}</span>
      </div>
      {isMraid && readiness.hostRequirements ? (
        <div className="field-stack">
          <div className="pill" style={{ borderColor: mraidHandoff?.readyForHostHandoff ? 'rgba(34,197,94,.35)' : mraidHandoff?.blockers.length ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
            {mraidHandoff?.readyForHostHandoff ? '✓' : '•'} MRAID {mraidHandoff?.readyForHostHandoff ? 'ready' : mraidHandoff?.blockers.length ? 'blocked' : 'needs review'}
          </div>
          <div className="meta-line">
            <span className="pill">Placement {readiness.hostRequirements.expectedPlacementType}</span>
            <span className="pill">Host features {readiness.hostRequirements.requiredFeatures.join(', ')}</span>
            <span className="pill">Warnings {mraidHandoff?.moduleCompatibility.summary.warningCount ?? 0}</span>
            <span className="pill">Blocked {mraidHandoff?.moduleCompatibility.summary.blockedCount ?? 0}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

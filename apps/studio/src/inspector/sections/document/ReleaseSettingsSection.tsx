import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportHandoff, buildExportReadiness } from '../../../export/engine';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { createInspectorField } from '../../contract-driven';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';

export function ReleaseSettingsSection(): JSX.Element {
  function getToneClass(kind: 'success' | 'warning' | 'danger'): string {
    return `pill pill--${kind}`;
  }

  const state = useStudioStore((value) => value);
  const { updateReleaseSettings } = useDocumentActions();
  const release = state.document.metadata.release;
  const readiness = buildExportReadiness(state);
  const handoff = buildExportHandoff(state);
  const mraidHandoff = release.targetChannel === 'mraid' ? handoff.mraid : undefined;

  return (
    <div className="field-stack">
      <div className="fields-grid">
        {createInspectorField({
          kind: 'select',
          label: 'Target channel',
          value: release.targetChannel,
          onChange: (value) => updateReleaseSettings({ targetChannel: value as typeof release.targetChannel }),
          options: ['generic-html5', 'google-display', 'gam-html5', 'mraid', 'meta-story', 'tiktok-vertical'].map((value) => ({ label: value, value })),
        })}
        {createInspectorField({
          kind: 'select',
          label: 'QA status',
          value: release.qaStatus,
          onChange: (value) => updateReleaseSettings({ qaStatus: value as typeof release.qaStatus }),
          options: ['draft', 'ready-for-qa', 'qa-passed'].map((value) => ({ label: value, value })),
        })}
      </div>
      {createInspectorField({
        kind: 'textarea',
        label: 'Release notes',
        rows: 4,
        value: release.notes ?? '',
        onChange: (value) => updateReleaseSettings({ notes: value }),
      })}
      <div className="meta-line">
        <span className="pill">Target {readiness.targetChannel}</span>
        <span className="pill">QA {readiness.qaStatus}</span>
        <span className="pill">Readiness {readiness.score}% · {readiness.grade}</span>
      </div>
      {mraidHandoff ? (
        <div className="field-stack">
          <div className={getToneClass(mraidHandoff.readyForHostHandoff ? 'success' : mraidHandoff.blockers.length ? 'danger' : 'warning')}>
            <StudioIcon icon={mraidHandoff.readyForHostHandoff ? StudioIcons.check : StudioIcons.circle} size={12} />
            {' '}
            MRAID {mraidHandoff.readyForHostHandoff ? 'ready' : mraidHandoff.blockers.length ? 'blocked' : 'needs review'}
          </div>
          <div className="meta-line">
            <span className="pill">Placement {mraidHandoff.placementType}</span>
            <span className="pill">Host features {Object.entries(mraidHandoff.requiredHostFeatures).filter(([, enabled]) => enabled).map(([key]) => key).join(', ')}</span>
            <span className="pill">Warnings {mraidHandoff.moduleCompatibility.warningCount}</span>
            <span className="pill">Blocked {mraidHandoff.moduleCompatibility.blockedCount}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

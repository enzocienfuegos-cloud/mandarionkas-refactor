import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportManifest, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { validateExport } from '../../../domain/document/export-validation';

export function ExportSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const manifest = buildExportManifest(state);
  const readiness = buildExportReadiness(state);
  const issues = validateExport(state);
  const mraidHandoff = manifest.handoff?.mraid;
  const errorCount = issues.filter((item) => item.level === 'error').length;
  const warningCount = issues.filter((item) => item.level === 'warning').length;
  const compatibility = mraidHandoff?.moduleCompatibility;
  const mraidStatusLabel = !mraidHandoff ? null : mraidHandoff.readyForHostHandoff ? 'MRAID-ready' : mraidHandoff.blockers.length ? 'MRAID blocked' : 'MRAID needs review';

  return (
    <div className="field-stack">
      <div className="meta-line">
        <span className="pill">Scenes {manifest.sceneCount}</span>
        <span className="pill">Widgets {manifest.widgetCount}</span>
        <span className="pill">Actions {manifest.actionCount}</span>
      </div>
      <div className="meta-line">
        <span className="pill">Errors {errorCount}</span>
        <span className="pill">Warnings {warningCount}</span>
        <span className="pill">Readiness {readiness.score}% · {readiness.grade}</span>
      </div>
      {mraidHandoff ? (
        <div className="field-stack">
          <div className="meta-line">
            <span className="pill">MRAID {mraidHandoff.apiVersion}</span>
            <span className="pill">Placement {mraidHandoff.placementType}</span>
            <span className="pill">Host {mraidHandoff.readyForHostHandoff ? 'ready' : 'review needed'}</span>
            <span className="pill" style={{ borderColor: mraidHandoff.readyForHostHandoff ? 'rgba(34,197,94,.35)' : mraidHandoff.blockers.length ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>{mraidStatusLabel}</span>
          </div>
          <div className="meta-line">
            <span className="pill">Requires {mraidHandoff.requiredHostFeatures.join(', ')}</span>
            <span className="pill">Size {mraidHandoff.standardSize.width}×{mraidHandoff.standardSize.height}</span>
          </div>
          <div className="meta-line">
            <span className="pill">Supported {compatibility?.supported.length ?? 0}</span>
            <span className="pill">Warnings {compatibility?.summary.warningCount ?? 0}</span>
            <span className="pill">Blocked {compatibility?.summary.blockedCount ?? 0}</span>
          </div>
          {compatibility?.warning.length ? (
            <div className="field-stack">
              <small className="muted">Modules that need review</small>
              {compatibility.warning.slice(0, 4).map((item) => (
                <div key={`mraid-compat-warning-${item.widgetId}`} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
                  warning · {item.widgetType} · {item.reason}
                </div>
              ))}
            </div>
          ) : null}
          {compatibility?.blocked.length ? (
            <div className="field-stack">
              <small className="muted">Modules blocking MRAID handoff</small>
              {compatibility.blocked.slice(0, 4).map((item) => (
                <div key={`mraid-compat-blocked-${item.widgetId}`} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
                  blocker · {item.widgetType} · {item.reason}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="field-stack">
        {readiness.checklist.map((item) => (
          <div key={item.label} className="pill" style={{ borderColor: item.passed ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)' }}>
            {item.passed ? '✓' : '•'} {item.label}
          </div>
        ))}
      </div>
      <div className="field-stack">
        <button onClick={() => triggerExportHtml(state)}>Export HTML</button>
        <button onClick={() => triggerExportManifest(state)}>Export manifest</button>
        <button onClick={() => triggerExportDocumentJson(state)}>Export document JSON</button>
        <button onClick={() => triggerExportPublishPackage(state)}>{mraidHandoff ? 'Export MRAID package' : 'Export publish package'}</button>
        <button onClick={() => triggerExportReviewPackage(state)}>{mraidHandoff ? 'Review MRAID package' : 'Export review package'}</button>
      </div>
      {issues.length ? (
        <div className="field-stack">
          {issues.slice(0, 6).map((issue, index) => (
            <div key={`${issue.scope}-${issue.targetId ?? index}`} className="pill" style={{ borderColor: issue.level === 'error' ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
              {issue.level} · {issue.message}
            </div>
          ))}
        </div>
      ) : <div className="pill">Export validation clean</div>}
      {mraidHandoff && (mraidHandoff.blockers.length || mraidHandoff.warnings.length) ? (
        <div className="field-stack">
          {mraidHandoff.blockers.map((item) => (
            <div key={`mraid-blocker-${item}`} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
              blocker · {item}
            </div>
          ))}
          {mraidHandoff.warnings.map((item) => (
            <div key={`mraid-warning-${item}`} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
              warning · {item}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

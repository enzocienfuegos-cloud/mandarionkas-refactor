import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildDiagnosticSummary, collectDiagnostics } from '../../../domain/document/diagnostics';
import { buildExportManifest, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';

export function DiagnosticsSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const summary = buildDiagnosticSummary(state);
  const issues = collectDiagnostics(state);
  const readiness = buildExportReadiness(state);
  const manifest = buildExportManifest(state);
  const mraidHandoff = manifest.handoff?.mraid;
  const compatibility = mraidHandoff?.moduleCompatibility;

  return (
    <div className="field-stack">
      <div className="meta-line">
        <span className="pill">Errors {summary.errors}</span>
        <span className="pill">Warnings {summary.warnings}</span>
        <span className="pill">Widgets {summary.widgets}</span>
      </div>
      <div className="meta-line">
        <span className="pill">Scenes {summary.scenes}</span>
        <span className="pill">Actions {summary.actions}</span>
        <span className="pill">Bindings {summary.bindings}</span>
        <span className="pill">Hidden {summary.hiddenWidgets}</span>
      </div>
      <small className="muted">Diagnostics stay document-level and release-oriented, instead of living in a giant panel file.</small>
      <div className="field-stack">
        {readiness.checklist.map((item) => (
          <div key={item.label} className="pill" style={{ borderColor: item.passed ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)' }}>
            {item.passed ? '✓' : '•'} {item.label}
          </div>
        ))}
      </div>
      <div className="field-stack">
        <small className="muted">Channel-specific checks</small>
        {manifest.channelChecklist.map((item) => (
          <div key={item.id} className="pill" style={{ borderColor: item.passed ? 'rgba(34,197,94,.35)' : item.severity === 'error' ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
            {item.passed ? '✓' : '•'} {item.label}
          </div>
        ))}
      </div>
      {mraidHandoff ? (
        <div className="field-stack">
          <small className="muted">MRAID handoff</small>
          <div className="meta-line">
            <span className="pill">API {mraidHandoff.apiVersion}</span>
            <span className="pill">Placement {mraidHandoff.placementType}</span>
            <span className="pill">Host features {mraidHandoff.requiredHostFeatures.join(', ')}</span>
            <span className="pill">{mraidHandoff.readyForHostHandoff ? 'ready' : mraidHandoff.blockers.length ? 'blocked' : 'review needed'}</span>
          </div>
          <div className="meta-line">
            <span className="pill">Supported {compatibility?.supported.length ?? 0}</span>
            <span className="pill">Warnings {compatibility?.summary.warningCount ?? 0}</span>
            <span className="pill">Blocked {compatibility?.summary.blockedCount ?? 0}</span>
          </div>
          {mraidHandoff.blockers.map((item) => (
            <div key={`handoff-blocker-${item}`} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
              blocker · {item}
            </div>
          ))}
          {mraidHandoff.warnings.map((item) => (
            <div key={`handoff-warning-${item}`} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
              warning · {item}
            </div>
          ))}
          {compatibility?.warning.length ? (
            <div className="field-stack">
              <small className="muted">Warning widgets</small>
              {compatibility.warning.slice(0, 5).map((item) => (
                <div key={`compat-warning-${item.widgetId}`} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
                  {item.widgetType} · {item.reason}
                </div>
              ))}
            </div>
          ) : null}
          {compatibility?.blocked.length ? (
            <div className="field-stack">
              <small className="muted">Blocked widgets</small>
              {compatibility.blocked.slice(0, 5).map((item) => (
                <div key={`compat-blocked-${item.widgetId}`} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
                  {item.widgetType} · {item.reason}
                </div>
              ))}
            </div>
          ) : null}
          {!mraidHandoff.blockers.length && !mraidHandoff.warnings.length ? (
            <div className="pill" style={{ borderColor: 'rgba(34,197,94,.35)' }}>
              ✓ MRAID handoff clean
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="field-stack">
        <button onClick={() => triggerExportHtml(state)}>Export HTML</button>
        <button onClick={() => triggerExportManifest(state)}>Export manifest</button>
        <button onClick={() => triggerExportDocumentJson(state)}>Export document JSON</button>
        <button onClick={() => triggerExportPublishPackage(state)}>{mraidHandoff ? 'Export MRAID package' : 'Export publish package'}</button>
        <button onClick={() => triggerExportReviewPackage(state)}>{mraidHandoff ? 'Review MRAID package' : 'Export review package'}</button>
      </div>
      {issues.length ? (
        <div className="field-stack">
          {issues.slice(0, 10).map((issue, index) => (
            <div key={`${issue.scope}-${issue.targetId ?? index}-${issue.message}`} className="pill" style={{ borderColor: issue.level === 'error' ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
              {issue.category} · {issue.level} · {issue.message}
            </div>
          ))}
        </div>
      ) : (
        <div className="pill">Document diagnostics clean</div>
      )}
    </div>
  );
}

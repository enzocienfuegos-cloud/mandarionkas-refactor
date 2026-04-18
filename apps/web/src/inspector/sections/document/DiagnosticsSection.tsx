import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildDiagnosticSummary, collectDiagnostics } from '../../../domain/document/diagnostics';
import { buildExportManifest, buildExportPreflight, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { ExportPreflightPanel } from '../../../export/ExportPreflightPanel';
import { useExportReadinessController } from '../../../app/shell/topbar/use-export-readiness-controller';
import { useTopBarStudioSnapshot } from '../../../app/shell/topbar/use-top-bar-studio-snapshot';

export function DiagnosticsSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const exportController = useExportReadinessController(useTopBarStudioSnapshot());
  const summary = buildDiagnosticSummary(state);
  const issues = collectDiagnostics(state);
  const readiness = buildExportReadiness(state);
  const manifest = buildExportManifest(state);
  const preflight = buildExportPreflight(state);
  const resolvedBlocked = !preflight.summary.readyForBundleZip || exportController.resolvedZipStatus === 'exporting';

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
        <div className="meta-line">
          <span className="pill">Channel blockers {preflight.summary.channelErrors}</span>
          <span className="pill">Channel warnings {preflight.summary.channelWarnings}</span>
        </div>
      </div>
      <div className="field-stack">
        <small className="muted">Package checks</small>
        <ExportPreflightPanel
          preflight={preflight}
          resolvedZipStatus={exportController.resolvedZipStatus}
          resolvedZipMessage={exportController.resolvedZipMessage}
          maxIssues={8}
        />
      </div>
      <div className="field-stack">
        <button onClick={() => triggerExportHtml(state)}>Export HTML</button>
        <button onClick={() => triggerExportManifest(state)}>Export manifest</button>
        <button onClick={() => triggerExportPreflight(state)}>Export preflight</button>
        <button onClick={() => triggerExportDocumentJson(state)}>Export document JSON</button>
        <button onClick={() => triggerExportPublishPackage(state)}>Export publish package</button>
        <button onClick={() => triggerExportReviewPackage(state)}>Export review package</button>
        <button onClick={() => void exportController.triggerExportZipBundleResolved(state)} disabled={resolvedBlocked} title={resolvedBlocked ? preflight.summary.recommendedNextStep : undefined}>
          {exportController.resolvedZipStatus === 'exporting' ? 'Exporting banner…' : 'Export banner'}
        </button>
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

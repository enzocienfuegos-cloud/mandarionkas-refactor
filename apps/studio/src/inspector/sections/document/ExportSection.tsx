import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportHandoff, buildExportManifest, buildExportPreflight, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { ExportPreflightPanel } from '../../../export/ExportPreflightPanel';
import { validateExport } from '../../../domain/document/export-validation';
import { useExportReadinessController } from '../../../app/shell/topbar/use-export-readiness-controller';
import { useTopBarStudioSnapshot } from '../../../app/shell/topbar/use-top-bar-studio-snapshot';

export function ExportSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const exportController = useExportReadinessController(useTopBarStudioSnapshot());
  const manifest = buildExportManifest(state);
  const readiness = buildExportReadiness(state);
  const preflight = buildExportPreflight(state);
  const handoff = buildExportHandoff(state);
  const mraidHandoff = state.document.metadata.release.targetChannel === 'mraid' ? handoff.mraid : undefined;
  const issues = validateExport(state);
  const errorCount = issues.filter((item) => item.level === 'error').length;
  const warningCount = issues.filter((item) => item.level === 'warning').length;
  const packageErrors = preflight.compliance.filter((item) => item.level === 'error').length;
  const packageWarnings = preflight.compliance.filter((item) => item.level === 'warning').length;
  const resolvedBlocked = !preflight.summary.readyForBundleZip || exportController.resolvedZipStatus === 'exporting';

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
      <div className="meta-line">
        <span className="pill">Pkg files {preflight.metrics.totalFiles}</span>
        <span className="pill">Pkg size {Math.round(preflight.metrics.totalBytes / 1024)} KB</span>
        <span className="pill">Pkg errors {packageErrors}</span>
        <span className="pill">Pkg warnings {packageWarnings}</span>
        <span className="pill">Pkg grade {preflight.summary.packageGrade} · {preflight.summary.packageScore}%</span>
      </div>
      <div className="meta-line">
        <span className="pill">Channel blockers {preflight.summary.channelErrors}</span>
        <span className="pill">Channel warnings {preflight.summary.channelWarnings}</span>
        <span className="pill">Delivery {preflight.summary.deliveryMode}</span>
      </div>
      {mraidHandoff ? (
        <div className="field-stack">
          <div className="meta-line">
            <span className="pill">MRAID {mraidHandoff.apiVersion}</span>
            <span className="pill">Placement {mraidHandoff.placementType}</span>
            <span className="pill" style={{ borderColor: mraidHandoff.readyForHostHandoff ? 'rgba(34,197,94,.35)' : mraidHandoff.blockers.length ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
              {mraidHandoff.readyForHostHandoff ? 'MRAID-ready' : mraidHandoff.blockers.length ? 'MRAID blocked' : 'MRAID needs review'}
            </span>
          </div>
          <div className="meta-line">
            <span className="pill">Supported {mraidHandoff.moduleCompatibility.supportedCount}</span>
            <span className="pill">Warnings {mraidHandoff.moduleCompatibility.warningCount}</span>
            <span className="pill">Blocked {mraidHandoff.moduleCompatibility.blockedCount}</span>
          </div>
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
        <small className="muted">Package preflight</small>
        <ExportPreflightPanel
          preflight={preflight}
          resolvedZipStatus={exportController.resolvedZipStatus}
          resolvedZipMessage={exportController.resolvedZipMessage}
        />
      </div>
      <div className="field-stack">
        <button onClick={() => triggerExportHtml(state)}>Export HTML</button>
        <button onClick={() => triggerExportManifest(state)}>Export manifest</button>
        <button onClick={() => triggerExportPreflight(state)}>Export preflight</button>
        <button onClick={() => triggerExportDocumentJson(state)}>Export document JSON</button>
        <button onClick={() => triggerExportPublishPackage(state)}>{mraidHandoff ? 'Export MRAID package' : 'Export publish package'}</button>
        <button onClick={() => triggerExportReviewPackage(state)}>{mraidHandoff ? 'Review MRAID package' : 'Export review package'}</button>
        <button onClick={() => void exportController.triggerExportZipBundleResolved(state)} disabled={resolvedBlocked} title={resolvedBlocked ? preflight.summary.recommendedNextStep : undefined}>
          {exportController.resolvedZipStatus === 'exporting' ? 'Exporting banner…' : 'Export banner'}
        </button>
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
      {mraidHandoff && (mraidHandoff.moduleCompatibility.blocked.length || mraidHandoff.moduleCompatibility.warnings.length) ? (
        <div className="field-stack">
          {mraidHandoff.moduleCompatibility.blocked.slice(0, 4).map((item) => (
            <div key={`mraid-blocked-${item.widgetId ?? item.widgetType}`} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
              blocker · {item.widgetType} · {item.message}
            </div>
          ))}
          {mraidHandoff.moduleCompatibility.warnings.slice(0, 4).map((item) => (
            <div key={`mraid-warning-${item.widgetId ?? item.widgetType}`} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
              warning · {item.widgetType} · {item.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

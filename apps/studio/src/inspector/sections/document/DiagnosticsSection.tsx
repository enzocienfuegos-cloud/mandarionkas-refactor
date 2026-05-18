import { useStudioStoreSnapshot } from '../../../core/store/use-studio-store';
import { buildDiagnosticSummary, collectDiagnostics } from '../../../domain/document/diagnostics';
import { buildExportHandoff, buildExportManifest, buildExportPreflight, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { ExportPreflightPanel } from '../../../export/ExportPreflightPanel';
import { useExportReadinessController } from '../../../app/shell/topbar/use-export-readiness-controller';
import { useTopBarStudioSnapshot } from '../../../app/shell/topbar/use-top-bar-studio-snapshot';
import { Button } from '../../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useToast } from '../../../shared/ui/ToastProvider';

export function DiagnosticsSection(): JSX.Element {
  function getToneClass(kind: 'success' | 'warning' | 'danger'): string {
    return `pill pill--${kind}`;
  }

  const state = useStudioStoreSnapshot();
  const exportController = useExportReadinessController(useTopBarStudioSnapshot());
  const summary = buildDiagnosticSummary(state);
  const issues = collectDiagnostics(state);
  const readiness = buildExportReadiness(state);
  const manifest = buildExportManifest(state);
  const preflight = buildExportPreflight(state);
  const handoff = buildExportHandoff(state);
  const { pushToast } = useToast();
  const mraidHandoff = state.document.metadata.release.targetChannel === 'mraid' ? handoff.mraid : undefined;
  const resolvedBlocked = !preflight.summary.readyForBundleZip || exportController.resolvedZipStatus === 'exporting';
  const statusIcon = (passed: boolean) => <StudioIcon icon={passed ? StudioIcons.check : StudioIcons.circle} size={12} />;

  function notifyDownload(title: string, description: string): void {
    pushToast({ title, description, tone: 'success' });
  }

  async function handlePublishPackageExport(): Promise<void> {
    try {
      await triggerExportPublishPackage(state);
      notifyDownload(mraidHandoff ? 'MRAID package exported' : 'Publish package exported', 'The publish package has been downloaded.');
    } catch (error) {
      pushToast({
        title: 'Publish package export failed',
        description: error instanceof Error ? error.message : 'Unable to export the publish package.',
        tone: 'danger',
      });
    }
  }

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
          <div key={item.label} className={getToneClass(item.passed ? 'success' : 'danger')}>
            {statusIcon(item.passed)} {item.label}
          </div>
        ))}
      </div>
      <div className="field-stack">
        <small className="muted">Channel-specific checks</small>
        {manifest.channelChecklist.map((item) => (
          <div key={item.id} className={getToneClass(item.passed ? 'success' : item.severity === 'error' ? 'danger' : 'warning')}>
            {statusIcon(item.passed)} {item.label}
          </div>
        ))}
        <div className="meta-line">
          <span className="pill">Channel blockers {preflight.summary.channelErrors}</span>
          <span className="pill">Channel warnings {preflight.summary.channelWarnings}</span>
        </div>
      </div>
      {mraidHandoff ? (
        <div className="field-stack">
          <small className="muted">MRAID handoff</small>
          <div className="meta-line">
            <span className="pill">API {mraidHandoff.apiVersion}</span>
            <span className="pill">Placement {mraidHandoff.placementType}</span>
            <span className="pill">Supported {mraidHandoff.moduleCompatibility.supportedCount}</span>
            <span className="pill">Warnings {mraidHandoff.moduleCompatibility.warningCount}</span>
            <span className="pill">Blocked {mraidHandoff.moduleCompatibility.blockedCount}</span>
          </div>
          {mraidHandoff.moduleCompatibility.blocked.slice(0, 5).map((item) => (
            <div key={`diag-mraid-blocked-${item.widgetId ?? item.widgetType}`} className="pill pill--danger">
              blocker · {item.widgetType} · {item.message}
            </div>
          ))}
          {mraidHandoff.moduleCompatibility.warnings.slice(0, 5).map((item) => (
            <div key={`diag-mraid-warning-${item.widgetId ?? item.widgetType}`} className="pill pill--warning">
              warning · {item.widgetType} · {item.message}
            </div>
          ))}
        </div>
      ) : null}
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
        <Button onClick={() => { triggerExportHtml(state); notifyDownload('HTML exported', 'Standalone HTML has been downloaded.'); }}>Export HTML</Button>
        <Button onClick={() => { triggerExportManifest(state); notifyDownload('Manifest exported', 'Manifest JSON has been downloaded.'); }}>Export manifest</Button>
        <Button onClick={() => { triggerExportPreflight(state); notifyDownload('Preflight exported', 'Preflight JSON has been downloaded.'); }}>Export preflight</Button>
        <Button onClick={() => { triggerExportDocumentJson(state); notifyDownload('Document JSON exported', 'Document JSON has been downloaded.'); }}>Export document JSON</Button>
        <Button onClick={() => void handlePublishPackageExport()}>{mraidHandoff ? 'Export MRAID package' : 'Export publish package'}</Button>
        <Button onClick={() => { triggerExportReviewPackage(state); notifyDownload(mraidHandoff ? 'MRAID review package exported' : 'Review package exported', 'The review package has been downloaded.'); }}>{mraidHandoff ? 'Review MRAID package' : 'Export review package'}</Button>
        <Tooltip content={resolvedBlocked ? preflight.summary.recommendedNextStep : 'Export resolved ZIP bundle'}>
          <span>
            <Button onClick={() => void exportController.triggerExportZipBundleResolved(state)} disabled={resolvedBlocked}>
              {exportController.resolvedZipStatus === 'exporting' ? 'Exporting banner…' : 'Export banner'}
            </Button>
          </span>
        </Tooltip>
      </div>
      {issues.length ? (
        <div className="field-stack">
          {issues.slice(0, 10).map((issue, index) => (
            <div key={`${issue.scope}-${issue.targetId ?? index}-${issue.message}`} className={getToneClass(issue.level === 'error' ? 'danger' : 'warning')}>
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

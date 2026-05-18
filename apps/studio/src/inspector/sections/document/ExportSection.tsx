import { useStudioStoreSnapshot } from '../../../core/store/use-studio-store';
import { buildExportHandoff, buildExportManifest, buildExportPreflight, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { ExportPreflightPanel } from '../../../export/ExportPreflightPanel';
import { validateExport } from '../../../domain/document/export-validation';
import { useExportReadinessController } from '../../../app/shell/topbar/use-export-readiness-controller';
import { useTopBarStudioSnapshot } from '../../../app/shell/topbar/use-top-bar-studio-snapshot';
import { Button } from '../../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { useToast } from '../../../shared/ui/ToastProvider';

export function ExportSection(): JSX.Element {
  function getToneClass(kind: 'success' | 'warning' | 'danger'): string {
    return `pill pill--${kind}`;
  }

  const state = useStudioStoreSnapshot();
  const exportController = useExportReadinessController(useTopBarStudioSnapshot());
  const manifest = buildExportManifest(state);
  const readiness = buildExportReadiness(state);
  const preflight = buildExportPreflight(state);
  const handoff = buildExportHandoff(state);
  const { pushToast } = useToast();
  const mraidHandoff = state.document.metadata.release.targetChannel === 'mraid' ? handoff.mraid : undefined;
  const issues = validateExport(state);
  const errorCount = issues.filter((item) => item.level === 'error').length;
  const warningCount = issues.filter((item) => item.level === 'warning').length;
  const packageErrors = preflight.compliance.filter((item) => item.level === 'error').length;
  const packageWarnings = preflight.compliance.filter((item) => item.level === 'warning').length;
  const resolvedBlocked = !preflight.summary.readyForBundleZip || exportController.resolvedZipStatus === 'exporting';
  const exportsSizeSet = state.document.canvasVariants.length > 1;
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
            <span className={getToneClass(mraidHandoff.readyForHostHandoff ? 'success' : mraidHandoff.blockers.length ? 'danger' : 'warning')}>
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
          <div key={item.label} className={getToneClass(item.passed ? 'success' : 'danger')}>
            {statusIcon(item.passed)} {item.label}
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
        <Button onClick={() => { triggerExportHtml(state); notifyDownload('HTML exported', 'Standalone HTML has been downloaded.'); }}>Export HTML</Button>
        <Button onClick={() => { triggerExportManifest(state); notifyDownload('Manifest exported', 'Manifest JSON has been downloaded.'); }}>Export manifest</Button>
        <Button onClick={() => { triggerExportPreflight(state); notifyDownload('Preflight exported', 'Preflight JSON has been downloaded.'); }}>Export preflight</Button>
        <Button onClick={() => { triggerExportDocumentJson(state); notifyDownload('Document JSON exported', 'Document JSON has been downloaded.'); }}>Export document JSON</Button>
        <Button onClick={() => void handlePublishPackageExport()}>{mraidHandoff ? 'Export MRAID package' : 'Export publish package'}</Button>
        <Button onClick={() => { triggerExportReviewPackage(state); notifyDownload(mraidHandoff ? 'MRAID review package exported' : 'Review package exported', 'The review package has been downloaded.'); }}>{mraidHandoff ? 'Review MRAID package' : 'Export review package'}</Button>
        <Tooltip content={resolvedBlocked ? preflight.summary.recommendedNextStep : exportsSizeSet ? 'Export resolved ZIP size set' : 'Export resolved ZIP bundle'}>
          <span>
            <Button onClick={() => void exportController.triggerExportZipBundleResolved(state)} disabled={resolvedBlocked}>
              {exportController.resolvedZipStatus === 'exporting' ? (exportsSizeSet ? 'Exporting size set…' : 'Exporting banner…') : (exportsSizeSet ? 'Export size set' : 'Export banner')}
            </Button>
          </span>
        </Tooltip>
      </div>
      {issues.length ? (
        <div className="field-stack">
          {issues.slice(0, 6).map((issue, index) => (
            <div key={`${issue.scope}-${issue.targetId ?? index}`} className={getToneClass(issue.level === 'error' ? 'danger' : 'warning')}>
              {issue.level} · {issue.message}
            </div>
          ))}
        </div>
      ) : <div className="pill">Export validation clean</div>}
      {mraidHandoff && (mraidHandoff.moduleCompatibility.blocked.length || mraidHandoff.moduleCompatibility.warnings.length) ? (
        <div className="field-stack">
          {mraidHandoff.moduleCompatibility.blocked.slice(0, 4).map((item) => (
            <div key={`mraid-blocked-${item.widgetId ?? item.widgetType}`} className="pill pill--danger">
              blocker · {item.widgetType} · {item.message}
            </div>
          ))}
          {mraidHandoff.moduleCompatibility.warnings.slice(0, 4).map((item) => (
            <div key={`mraid-warning-${item.widgetId ?? item.widgetType}`} className="pill pill--warning">
              warning · {item.widgetType} · {item.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

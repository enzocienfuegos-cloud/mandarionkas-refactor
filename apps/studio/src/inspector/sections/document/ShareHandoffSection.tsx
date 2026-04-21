import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportPreflight, triggerExportPreflight, triggerExportReviewPackage } from '../../../export/engine';
import { ExportPreflightPanel } from '../../../export/ExportPreflightPanel';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { useExportReadinessController } from '../../../app/shell/topbar/use-export-readiness-controller';
import { useTopBarStudioSnapshot } from '../../../app/shell/topbar/use-top-bar-studio-snapshot';

export function ShareHandoffSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const exportController = useExportReadinessController(useTopBarStudioSnapshot());
  const { setShareLink } = useDocumentActions();
  const preflight = buildExportPreflight(state);
  const shareLink = state.document.collaboration.shareLink ?? `smx://review/${state.document.id}`;
  const openComments = state.document.collaboration.comments.filter((item) => item.status === 'open').length;
  const pendingApprovals = state.document.collaboration.approvals.filter((item) => item.status === 'pending').length;

  return (
    <div className="field-stack">
      <div className="meta-line">
        <span className="pill">Open comments {openComments}</span>
        <span className="pill">Pending approvals {pendingApprovals}</span>
        <span className="pill">Pkg grade {preflight.summary.packageGrade} · {preflight.summary.packageScore}%</span>
        <span className="pill">{preflight.summary.readyForResolvedZip ? 'Resolved handoff ready' : 'Resolved handoff pending'}</span>
        <span className="pill">Preferred {preflight.summary.preferredArtifact}</span>
      </div>
      <div className="field-stack">
        <ExportPreflightPanel
          preflight={preflight}
          resolvedZipStatus={exportController.resolvedZipStatus}
          resolvedZipMessage={exportController.resolvedZipMessage}
          maxIssues={4}
          compact
        />
      </div>
      <div>
        <label>Share link</label>
        <input value={shareLink} onChange={(event) => setShareLink(event.target.value)} />
      </div>
      <div className="meta-line">
        <button onClick={() => navigator.clipboard?.writeText(shareLink)}>Copy link</button>
        <button onClick={() => triggerExportPreflight(state)}>Export preflight</button>
        <button onClick={() => triggerExportReviewPackage(state)}>Export review package</button>
      </div>
      <small className="muted">Review and handoff stay document-level concerns, separate from the widget inspector and canvas runtime.</small>
    </div>
  );
}

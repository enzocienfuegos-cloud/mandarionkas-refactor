import { useState } from 'react';
import type { TopBarController } from './use-top-bar-controller';
import { ExportPreflightPanel } from '../../../export/ExportPreflightPanel';

export function TopBarExportControls({ controller, compact = false }: { controller: TopBarController; compact?: boolean }): JSX.Element {
  const [showPreflight, setShowPreflight] = useState(false);
  const { state, dirty } = controller.snapshot;
  const { handleLogout } = controller.workspace;
  const { exportIssues, preflight, handoff, resolvedZipStatus, resolvedZipMessage, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportDocumentJson, triggerExportPublishPackage, triggerExportReviewPackage, triggerExportZipBundleResolved } = controller.exportReadiness;
  const blockers = exportIssues.filter((item) => item.level === 'error').length;
  const packageWarnings = preflight.summary.warnings;
  const mraidHandoff = state.document.metadata.release.targetChannel === 'mraid' ? handoff.mraid : undefined;
  const primaryLabel = dirty
    ? `Unsaved · ${blockers} blockers`
    : `Saved · ${preflight.summary.packageGrade} · ${packageWarnings} warnings`;
  const resolvedBlocked = !preflight.summary.readyForBundleZip || resolvedZipStatus === 'exporting';
  return (
    <div className={`top-control-group ${compact ? 'top-control-group--compact' : ''}`}>
      <strong className="section-kicker">Export</strong>
      {mraidHandoff ? (
        <div className="meta-line">
          <span className="pill">MRAID</span>
          <span className="pill">{mraidHandoff.placementType}</span>
          <span className="pill">{mraidHandoff.moduleCompatibility.warningCount} warnings</span>
          <span className="pill">{mraidHandoff.moduleCompatibility.blockedCount} blocked</span>
        </div>
      ) : null}
      <div className="top-control-grid">
        <button className="ghost" onClick={() => triggerExportHtml(state)}>HTML</button>
        <button className="ghost" onClick={() => triggerExportManifest(state)}>Manifest</button>
        <button className="ghost" onClick={() => triggerExportPreflight(state)}>Preflight</button>
        <button className="ghost" onClick={() => triggerExportDocumentJson(state)}>JSON</button>
        <button className="ghost" onClick={() => triggerExportPublishPackage(state)}>{mraidHandoff ? 'MRAID package' : 'Publish package'}</button>
        <button className="ghost" onClick={() => triggerExportReviewPackage(state)}>{mraidHandoff ? 'MRAID review' : 'Review package'}</button>
        <button className="ghost" onClick={() => setShowPreflight((value) => !value)}>
          {showPreflight ? 'Hide preflight' : 'Show preflight'}
        </button>
        <button className="ghost" onClick={() => void triggerExportZipBundleResolved(state)} disabled={resolvedBlocked} title={resolvedBlocked ? preflight.summary.recommendedNextStep : undefined}>
          {resolvedZipStatus === 'exporting' ? 'Exporting banner…' : 'Export banner'}
        </button>
        <button className="ghost" onClick={handleLogout}>Logout</button>
        <button className="primary" title={preflight.summary.recommendedNextStep}>{primaryLabel}</button>
      </div>
      {resolvedZipMessage ? <small className="muted">{resolvedZipStatus} · {resolvedZipMessage}</small> : null}
      {showPreflight ? (
        <div className="top-control-preflight">
          <ExportPreflightPanel
            preflight={preflight}
            resolvedZipStatus={resolvedZipStatus}
            resolvedZipMessage={resolvedZipMessage}
            maxIssues={4}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}

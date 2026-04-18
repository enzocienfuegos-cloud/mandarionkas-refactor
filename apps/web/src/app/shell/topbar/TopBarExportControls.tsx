import type { TopBarController } from './use-top-bar-controller';

export function TopBarExportControls({ controller, compact = false }: { controller: TopBarController; compact?: boolean }): JSX.Element {
  const { state, dirty } = controller.snapshot;
  const { handleLogout } = controller.workspace;
  const { exportIssues, readiness, triggerExportHtml, triggerExportManifest, triggerExportDocumentJson, triggerExportPublishPackage, triggerExportReviewPackage } = controller.exportReadiness;
  const blockers = exportIssues.filter((item) => item.level === 'error').length;
  const isMraid = state.document.metadata.release.targetChannel === 'mraid';
  const mraidSummary = isMraid && readiness.hostRequirements
    ? `${readiness.hostRequirements.expectedPlacementType} · ${readiness.hostRequirements.requiredFeatures.join(', ')}`
    : null;
  return (
    <div className={`top-control-group ${compact ? 'top-control-group--compact' : ''}`}>
      <strong className="section-kicker">Export</strong>
      {isMraid ? <div className="meta-line"><span className="pill">MRAID</span><span className="pill">{mraidSummary}</span><span className="pill">{blockers === 0 ? 'Ready' : `${blockers} blockers`}</span></div> : null}
      <div className="top-control-grid">
        <button className="ghost" onClick={() => triggerExportHtml(state)}>HTML</button>
        <button className="ghost" onClick={() => triggerExportManifest(state)}>Manifest</button>
        <button className="ghost" onClick={() => triggerExportDocumentJson(state)}>JSON</button>
        <button className="ghost" onClick={() => triggerExportPublishPackage(state)}>{isMraid ? 'MRAID package' : 'Publish package'}</button>
        <button className="ghost" onClick={() => triggerExportReviewPackage(state)}>{isMraid ? 'MRAID review' : 'Review package'}</button>
        <button className="ghost" onClick={handleLogout}>Logout</button>
        <button className="primary">{dirty ? `Unsaved · ${blockers} blockers` : 'Saved'}</button>
      </div>
    </div>
  );
}

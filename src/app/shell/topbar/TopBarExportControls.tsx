import type { TopBarController } from './use-top-bar-controller';

export function TopBarExportControls({ controller, compact = false }: { controller: TopBarController; compact?: boolean }): JSX.Element {
  const { state, dirty } = controller.snapshot;
  const { handleLogout } = controller.workspace;
  const { exportIssues, qualityProfile, setQualityProfile, triggerExportHtml, triggerExportManifest, triggerExportDocumentJson, triggerExportPackageFiles, triggerExportPublishPackage, triggerExportReviewPackage } = controller.exportReadiness;
  const blockers = exportIssues.filter((item) => item.level === 'error').length;
  return (
    <div className={`top-control-group ${compact ? 'top-control-group--compact' : ''}`}>
      <strong className="section-kicker">Export</strong>
      <div className="top-control-grid">
        <select value={qualityProfile} onChange={(event) => setQualityProfile(event.target.value as typeof qualityProfile)}>
          <option value="high">Quality: high</option>
          <option value="medium">Quality: medium</option>
          <option value="low">Quality: low</option>
        </select>
        <button className="ghost" onClick={() => triggerExportHtml(state, { qualityProfile })}>HTML</button>
        <button className="ghost" onClick={() => triggerExportManifest(state, { qualityProfile })}>Manifest</button>
        <button className="ghost" onClick={() => triggerExportDocumentJson(state)}>JSON</button>
        <button className="ghost" onClick={() => triggerExportPackageFiles(state, { qualityProfile })}>Package files</button>
        <button className="ghost" onClick={() => triggerExportPublishPackage(state, { qualityProfile })}>Publish package</button>
        <button className="ghost" onClick={() => triggerExportReviewPackage(state, { qualityProfile })}>Review package</button>
        <button className="ghost" onClick={handleLogout}>Logout</button>
        <button className="primary">{dirty ? `Unsaved · ${blockers} blockers` : 'Saved'}</button>
      </div>
    </div>
  );
}

import type { TopBarController } from './use-top-bar-controller';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { Button } from '../../../shared/ui/Button';
import { Tooltip } from '../../../shared/ui/Tooltip';

export function TopBarExportControls({ controller, compact = false }: { controller: TopBarController; compact?: boolean }): JSX.Element {
  const { updateReleaseSettings } = useDocumentActions();
  const { state, dirty } = controller.snapshot;
  const { handleLogout } = controller.workspace;
  const { exportIssues, handoff, resolvedZipStatus, resolvedZipMessage, triggerExportHtml, triggerExportManifest, triggerExportPreflight, triggerExportDocumentJson, triggerExportPublishPackage, triggerExportReviewPackage, triggerExportZipBundleResolved } = controller.exportReadiness;
  const blockers = exportIssues.filter((item) => item.level === 'error').length;
  const mraidHandoff = state.document.metadata.release.targetChannel === 'mraid' ? handoff.mraid : undefined;
  const targetChannel = state.document.metadata.release.targetChannel;
  const exportsSizeSet = state.document.canvasVariants.length > 1;
  const primaryLabel = dirty
    ? `Unsaved · ${blockers} blockers`
    : 'Saved';
  const resolvedBlocked = resolvedZipStatus === 'exporting';
  return (
    <div className={`top-control-group ${compact ? 'top-control-group--compact' : ''}`}>
      <strong className="section-kicker">Export</strong>
      <div className="meta-line">
        <span className="pill">Export target</span>
        <select
          value={targetChannel}
          onChange={(event) => updateReleaseSettings({ targetChannel: event.target.value as typeof targetChannel })}
          aria-label="Export target"
          className="control-min-export-target"
        >
          <option value="generic-html5">IAB HTML5</option>
          <option value="google-display">Google Display</option>
          <option value="gam-html5">GAM HTML5</option>
          <option value="mraid">MRAID</option>
          <option value="meta-story">Meta Story</option>
          <option value="tiktok-vertical">TikTok Vertical</option>
        </select>
      </div>
      {mraidHandoff ? (
        <div className="meta-line">
          <span className="pill">MRAID</span>
          <span className="pill">{mraidHandoff.placementType}</span>
          <span className="pill">{mraidHandoff.moduleCompatibility.warningCount} warnings</span>
          <span className="pill">{mraidHandoff.moduleCompatibility.blockedCount} blocked</span>
        </div>
      ) : null}
      <div className="top-control-grid">
        <Button variant="ghost" size="sm" onClick={() => triggerExportHtml(state)}>HTML</Button>
        <Button variant="ghost" size="sm" onClick={() => triggerExportManifest(state)}>Manifest</Button>
        <Button variant="ghost" size="sm" onClick={() => triggerExportPreflight(state)}>Preflight</Button>
        <Button variant="ghost" size="sm" onClick={() => triggerExportDocumentJson(state)}>JSON</Button>
        <Button variant="ghost" size="sm" onClick={() => triggerExportPublishPackage(state)}>{mraidHandoff ? 'MRAID package' : 'Publish package'}</Button>
        <Button variant="ghost" size="sm" onClick={() => triggerExportReviewPackage(state)}>{mraidHandoff ? 'MRAID review' : 'Review package'}</Button>
        <Tooltip content={exportsSizeSet ? 'Export resolved ZIP size set' : 'Export resolved ZIP bundle'}>
          <span>
            <Button variant="ghost" size="sm" onClick={() => void triggerExportZipBundleResolved(state)} disabled={resolvedBlocked}>
              {resolvedZipStatus === 'exporting' ? (exportsSizeSet ? 'Exporting size set…' : 'Exporting banner…') : (exportsSizeSet ? 'Export size set' : 'Export banner')}
            </Button>
          </span>
        </Tooltip>
        <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
        <Button variant="primary" size="sm">{primaryLabel}</Button>
      </div>
      {resolvedZipMessage ? <small className="muted">{resolvedZipStatus} · {resolvedZipMessage}</small> : null}
    </div>
  );
}

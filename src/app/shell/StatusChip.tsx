import { useState } from 'react';
import type { TopBarController } from './topbar/use-top-bar-controller';
import { TopBarDocumentControls } from './topbar/TopBarDocumentControls';
import { TopBarWorkspaceControls } from './topbar/TopBarWorkspaceControls';
import { TopBarExportControls } from './topbar/TopBarExportControls';

function toneForGrade(grade: string): 'good' | 'warn' | 'danger' {
  if (grade === 'A' || grade === 'B') return 'good';
  if (grade === 'C' || grade === 'D') return 'warn';
  return 'danger';
}

export function StatusChip({ controller }: { controller: TopBarController }): JSX.Element {
  const [open, setOpen] = useState(false);
  const { readiness, diagnostics } = controller.exportReadiness;
  const { openComments, pendingApprovals } = controller.collaboration;
  const { release, lastAutosavedAt } = controller.snapshot;
  const tone = toneForGrade(readiness.grade);

  return (
    <div className="status-chip-shell">
      <button
        type="button"
        className={`status-chip status-chip--${tone}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="status-dot" />
        <span>{readiness.grade} · {readiness.score}%</span>
      </button>
      {open ? (
        <div className="status-popover panel">
          <div className="status-popover-head">
            <div>
              <strong>Studio status</strong>
              <div><small className="muted">Everything that used to live as pills now lives here.</small></div>
            </div>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="status-metrics-grid">
            <div className="status-metric"><span className="muted">Readiness</span><strong>{readiness.grade} · {readiness.score}%</strong></div>
            <div className="status-metric"><span className="muted">Diagnostics</span><strong>{diagnostics.errors}E / {diagnostics.warnings}W</strong></div>
            <div className="status-metric"><span className="muted">Comments</span><strong>{openComments} open</strong></div>
            <div className="status-metric"><span className="muted">Approvals</span><strong>{pendingApprovals} pending</strong></div>
            <div className="status-metric"><span className="muted">Release</span><strong>{release.targetChannel}</strong></div>
            <div className="status-metric"><span className="muted">QA</span><strong>{release.qaStatus}</strong></div>
            <div className="status-metric"><span className="muted">Autosave</span><strong>{lastAutosavedAt ? new Date(lastAutosavedAt).toLocaleTimeString() : 'Not yet'}</strong></div>
          </div>
          <div className="status-popover-section">
            <TopBarDocumentControls controller={controller} compact />
          </div>
          <div className="status-popover-section">
            <TopBarWorkspaceControls controller={controller} compact />
          </div>
          <div className="status-popover-section">
            <TopBarExportControls controller={controller} compact />
          </div>
        </div>
      ) : null}
    </div>
  );
}

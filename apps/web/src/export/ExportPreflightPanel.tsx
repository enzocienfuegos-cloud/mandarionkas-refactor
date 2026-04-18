import type { buildExportPreflight } from './preflight';

type ExportPreflight = ReturnType<typeof buildExportPreflight>;

export function ExportPreflightPanel({
  preflight,
  resolvedZipStatus,
  resolvedZipMessage,
  maxIssues = 6,
  compact = false,
}: {
  preflight: ExportPreflight;
  resolvedZipStatus?: 'idle' | 'exporting' | 'success' | 'error';
  resolvedZipMessage?: string;
  maxIssues?: number;
  compact?: boolean;
}): JSX.Element {
  const blockers = [...preflight.channelBlockers, ...preflight.packageBlockers];
  const warnings = [...preflight.channelWarnings, ...preflight.packageWarnings];

  return (
    <div className={`export-preflight-panel ${compact ? 'export-preflight-panel--compact' : ''}`}>
      <div className="meta-line">
        <span className="pill">Delivery {preflight.summary.deliveryMode}</span>
        <span className="pill">Preferred {preflight.summary.preferredArtifact}</span>
        <span className="pill">Pkg grade {preflight.summary.packageGrade} · {preflight.summary.packageScore}%</span>
        <span className="pill">Files {preflight.metrics.totalFiles}</span>
        <span className="pill">Size {Math.round(preflight.metrics.totalBytes / 1024)} KB</span>
      </div>
      <div className="meta-line">
        <span className="pill">Channel blockers {preflight.summary.channelErrors}</span>
        <span className="pill">Channel warnings {preflight.summary.channelWarnings}</span>
        <span className="pill">Package blockers {preflight.packageBlockers.length}</span>
        <span className="pill">Package warnings {preflight.packageWarnings.length}</span>
        <span className="pill">Pending remote {preflight.summary.remoteAssetPendingCount}</span>
        {resolvedZipStatus ? <span className="pill">Resolved ZIP {resolvedZipStatus}</span> : null}
      </div>
      {preflight.summary.blockers === 0 ? (
        <div className="pill" style={{ borderColor: 'rgba(34,197,94,.35)' }}>
          Export available · usa Export banner
        </div>
      ) : null}
      {preflight.summary.topBlocker ? (
        <div className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
          blocker · {preflight.summary.topBlocker}
        </div>
      ) : null}
      {preflight.summary.topWarning ? (
        <div className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
          warning · {preflight.summary.topWarning}
        </div>
      ) : null}
      <div className="pill">Next step · {preflight.summary.recommendedNextStep}</div>
      {resolvedZipMessage ? <div className="pill">Resolved ZIP · {resolvedZipMessage}</div> : null}
      {blockers.length ? (
        <div className="field-stack">
          <small className="muted">Blockers</small>
          {blockers.slice(0, maxIssues).map((issue, index) => (
            <div key={`${issue.code}-${issue.targetId ?? index}`} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
              {issue.scope} · {issue.code} · {issue.message}
            </div>
          ))}
        </div>
      ) : (
        <div className="pill">No blockers</div>
      )}
      {warnings.length ? (
        <div className="field-stack">
          <small className="muted">Warnings</small>
          {warnings.slice(0, maxIssues).map((issue, index) => (
            <div key={`${issue.code}-${issue.targetId ?? index}`} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
              {issue.scope} · {issue.code} · {issue.message}
            </div>
          ))}
        </div>
      ) : (
        <div className="pill">No warnings</div>
      )}
    </div>
  );
}

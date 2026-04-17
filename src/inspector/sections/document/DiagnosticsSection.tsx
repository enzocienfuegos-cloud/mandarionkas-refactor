import { useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildDiagnosticSummary, collectDiagnostics } from '../../../domain/document/diagnostics';
import { buildExportManifest, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPackageFiles, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';

export function DiagnosticsSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const [qualityProfile, setQualityProfile] = useState<'high' | 'medium' | 'low'>('medium');
  const summary = buildDiagnosticSummary(state);
  const issues = collectDiagnostics(state);
  const readiness = buildExportReadiness(state, { qualityProfile });
  const manifest = buildExportManifest(state, { qualityProfile });
  const targetCoverage = readiness.targetCoverage;
  const coveredTargets = targetCoverage.filter((item) => item.coverage === 'full');
  const partialTargets = targetCoverage.filter((item) => item.coverage === 'partial');
  const openTargets = targetCoverage.filter((item) => item.coverage === 'none');

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
      <div className="meta-line">
        <span className="pill">Tier {readiness.interactionTier}</span>
        <span className="pill">Required {readiness.highestRequiredTier}</span>
        <span className="pill">Quality {readiness.qualityProfile}</span>
        <span className="pill">Exits {manifest.exitCount}</span>
        <span className="pill">Assets {manifest.assetCount}</span>
      </div>
      <div>
        <label>Quality profile</label>
        <select value={qualityProfile} onChange={(event) => setQualityProfile(event.target.value as typeof qualityProfile)}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <small className="muted">Diagnostics stay document-level and release-oriented, instead of living in a giant panel file.</small>
      <div className="field-stack">
        {readiness.checklist.map((item) => (
          <div key={item.label} className="pill" style={{ borderColor: item.passed ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)' }}>
            {item.passed ? '✓' : '•'} {item.label}
          </div>
        ))}
      </div>
      <div className="field-stack">
        <small className="muted">Channel-specific checks</small>
        {manifest.channelChecklist.map((item) => (
          <div key={item.id} className="pill" style={{ borderColor: item.passed ? 'rgba(34,197,94,.35)' : item.severity === 'error' ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
            {item.passed ? '✓' : '•'} {item.label}
          </div>
        ))}
      </div>
      <div className="field-stack">
        <small className="muted">Capability checks</small>
        <div className="meta-line">
          <span className="pill">Degraded {manifest.degradedWidgetCount}</span>
          <span className="pill">Blocked {manifest.blockedWidgetCount}</span>
        </div>
        {readiness.capabilitySummary.blockers.length ? readiness.capabilitySummary.blockers.slice(0, 8).map((item) => (
          <div key={item.widgetId} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
            blocker · {item.widgetName} · {item.widgetType} · requires {item.minimumTier}
            {item.notes?.length ? ` · ${item.notes.join(' / ')}` : ''}
          </div>
        )) : <div className="pill">No capability blockers</div>}
        {readiness.capabilitySummary.degraded.length ? readiness.capabilitySummary.degraded.slice(0, 8).map((item) => (
          <div key={item.widgetId} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
            degraded · {item.widgetName} · {item.widgetType}{item.degradationStrategy ? ` · ${item.degradationStrategy}` : ''}
            {item.notes?.length ? ` · ${item.notes.join(' / ')}` : ''}
          </div>
        )) : <div className="pill">No degraded widgets</div>}
      </div>
      <div className="field-stack">
        <small className="muted">Asset packaging</small>
        <div className="meta-line">
          <span className="pill">Bundled {manifest.bundledAssetCount}</span>
          <span className="pill">External {manifest.externalAssetCount}</span>
          <span className="pill">Blob {manifest.blobAssetCount}</span>
        </div>
        {manifest.externalAssetCount ? <div className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
          this export still depends on external asset references
        </div> : <div className="pill">No external asset references detected</div>}
        {manifest.blobAssetCount ? <div className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
          blob asset references are present and should be resolved before final packaging
        </div> : null}
      </div>
      <div className="field-stack">
        <small className="muted">Target coverage</small>
        <div className="meta-line">
          <span className="pill">Full {coveredTargets.length}</span>
          <span className="pill">Partial {partialTargets.length}</span>
          <span className="pill">Open {openTargets.length}</span>
          <span className="pill">Missing targets {manifest.uncoveredTargetCount}</span>
        </div>
        {targetCoverage.length ? targetCoverage.slice(0, 10).map((item) => (
          <div
            key={item.widgetId}
            className="pill"
            style={{
              borderColor: item.coverage === 'full'
                ? 'rgba(34,197,94,.35)'
                : item.coverage === 'partial'
                  ? 'rgba(245,158,11,.45)'
                  : 'rgba(239,68,68,.45)',
            }}
          >
            {item.coverage} · {item.widgetName} · {item.widgetType}
            {item.missingTargets.length ? ` · missing ${item.missingTargets.join(', ')}` : ''}
          </div>
        )) : <div className="pill">No multi-target widgets in this export</div>}
      </div>
      <div className="field-stack">
        <button onClick={() => triggerExportHtml(state, { qualityProfile })}>Export HTML</button>
        <button onClick={() => triggerExportManifest(state, { qualityProfile })}>Export manifest</button>
        <button onClick={() => triggerExportDocumentJson(state)}>Export document JSON</button>
        <button onClick={() => triggerExportPackageFiles(state, { qualityProfile })}>Export package files</button>
        <button onClick={() => triggerExportPublishPackage(state, { qualityProfile })}>Export publish package</button>
        <button onClick={() => triggerExportReviewPackage(state, { qualityProfile })}>Export review package</button>
      </div>
      {issues.length ? (
        <div className="field-stack">
          {issues.slice(0, 10).map((issue, index) => (
            <div key={`${issue.scope}-${issue.targetId ?? index}-${issue.message}`} className="pill" style={{ borderColor: issue.level === 'error' ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
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

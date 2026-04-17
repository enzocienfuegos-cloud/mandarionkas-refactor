import { useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportManifest, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPackageFiles, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { validateExport } from '../../../domain/document/export-validation';

export function ExportSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const [qualityProfile, setQualityProfile] = useState<'high' | 'medium' | 'low'>('medium');
  const manifest = buildExportManifest(state, { qualityProfile });
  const readiness = buildExportReadiness(state, { qualityProfile });
  const issues = validateExport(state);
  const errorCount = issues.filter((item) => item.level === 'error').length;
  const warningCount = issues.filter((item) => item.level === 'warning').length;
  const capabilityBlockers = readiness.capabilitySummary.blockers;
  const degradedWidgets = readiness.capabilitySummary.degraded;
  const targetCoverage = readiness.targetCoverage;
  const coveredTargets = targetCoverage.filter((item) => item.coverage === 'full');
  const partialTargets = targetCoverage.filter((item) => item.coverage === 'partial');
  const openTargets = targetCoverage.filter((item) => item.coverage === 'none');

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
      <div className="field-stack">
        {readiness.checklist.map((item) => (
          <div key={item.label} className="pill" style={{ borderColor: item.passed ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)' }}>
            {item.passed ? '✓' : '•'} {item.label}
          </div>
        ))}
      </div>
      <div className="field-stack">
        <small className="muted">Capability summary</small>
        <div className="meta-line">
          <span className="pill">Supported {readiness.capabilitySummary.supported.length}</span>
          <span className="pill">Degraded {degradedWidgets.length}</span>
          <span className="pill">Blocked {capabilityBlockers.length}</span>
        </div>
        {capabilityBlockers.length ? capabilityBlockers.slice(0, 6).map((item) => (
          <div key={item.widgetId} className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
            blocker · {item.widgetName} · {item.widgetType} · requires {item.minimumTier}
            {item.notes?.length ? ` · ${item.notes.join(' / ')}` : ''}
          </div>
        )) : <div className="pill">No capability blockers</div>}
        {degradedWidgets.length ? degradedWidgets.slice(0, 6).map((item) => (
          <div key={item.widgetId} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
            degraded · {item.widgetName} · {item.widgetType}{item.degradationStrategy ? ` · ${item.degradationStrategy}` : ''}
            {item.notes?.length ? ` · ${item.notes.join(' / ')}` : ''}
          </div>
        )) : <div className="pill">No degraded widgets</div>}
      </div>
      <div className="field-stack">
        <small className="muted">Asset packaging</small>
        <div className="meta-line">
          <span className="pill">Bundled {readiness.assetSummary.bundledCount}</span>
          <span className="pill">External {readiness.assetSummary.externalReferenceCount}</span>
          <span className="pill">Blob {readiness.assetSummary.blobUrlCount}</span>
        </div>
        {readiness.assetSummary.externalReferenceCount ? <div className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
          external-reference assets remain in this export bundle
        </div> : <div className="pill">All current assets are locally packageable</div>}
        {readiness.assetSummary.blobUrlCount ? <div className="pill" style={{ borderColor: 'rgba(239,68,68,.45)' }}>
          blob-based assets still need a resolvable local payload before packaging is robust
        </div> : null}
      </div>
      <div className="field-stack">
        <small className="muted">Target coverage</small>
        <div className="meta-line">
          <span className="pill">Full {coveredTargets.length}</span>
          <span className="pill">Partial {partialTargets.length}</span>
          <span className="pill">Open {openTargets.length}</span>
        </div>
        {targetCoverage.length ? targetCoverage.slice(0, 8).map((item) => (
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
          {issues.slice(0, 6).map((issue, index) => (
            <div key={`${issue.scope}-${issue.targetId ?? index}`} className="pill" style={{ borderColor: issue.level === 'error' ? 'rgba(239,68,68,.45)' : 'rgba(245,158,11,.45)' }}>
              {issue.level} · {issue.message}
            </div>
          ))}
        </div>
      ) : <div className="pill">Export validation clean</div>}
    </div>
  );
}

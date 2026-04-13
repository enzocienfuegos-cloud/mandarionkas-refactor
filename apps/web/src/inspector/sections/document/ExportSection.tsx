import { useStudioStore } from '../../../core/store/use-studio-store';
import { buildExportManifest, buildExportReadiness, triggerExportDocumentJson, triggerExportHtml, triggerExportManifest, triggerExportPublishPackage, triggerExportReviewPackage } from '../../../export/engine';
import { validateExport } from '../../../domain/document/export-validation';

export function ExportSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const manifest = buildExportManifest(state);
  const readiness = buildExportReadiness(state);
  const issues = validateExport(state);
  const errorCount = issues.filter((item) => item.level === 'error').length;
  const warningCount = issues.filter((item) => item.level === 'warning').length;

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
      <div className="field-stack">
        {readiness.checklist.map((item) => (
          <div key={item.label} className="pill" style={{ borderColor: item.passed ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)' }}>
            {item.passed ? '✓' : '•'} {item.label}
          </div>
        ))}
      </div>
      <div className="field-stack">
        <button onClick={() => triggerExportHtml(state)}>Export HTML</button>
        <button onClick={() => triggerExportManifest(state)}>Export manifest</button>
        <button onClick={() => triggerExportDocumentJson(state)}>Export document JSON</button>
        <button onClick={() => triggerExportPublishPackage(state)}>Export publish package</button>
        <button onClick={() => triggerExportReviewPackage(state)}>Export review package</button>
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

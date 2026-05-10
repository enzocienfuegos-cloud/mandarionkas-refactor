import { Tooltip } from '../../../shared/ui/Tooltip';
import type { TopBarController } from './use-top-bar-controller';

function buildBreadcrumb(controller: TopBarController): string {
  const parts = [
    controller.workspace.activeClient?.name ?? controller.snapshot.platformMeta?.clientName,
    controller.snapshot.platformMeta?.brandName,
    controller.snapshot.platformMeta?.campaignName,
  ].filter(Boolean);

  return parts.length ? parts.join(' / ') : 'Studio workspace';
}

function toneForGrade(grade: string): 'good' | 'warn' | 'danger' {
  if (grade === 'A' || grade === 'B') return 'good';
  if (grade === 'C' || grade === 'D') return 'warn';
  return 'danger';
}

export function buildSceneLabel(controller: TopBarController): string {
  const index = controller.snapshot.scenes.findIndex((scene) => scene.id === controller.snapshot.activeSceneId);
  const activeScene = controller.snapshot.scenes[index];
  if (!activeScene) return 'Scene';
  const base = activeScene.name?.trim() ? activeScene.name : `Scene ${index + 1}`;
  return index >= 0 ? `${index + 1}. ${base}` : base;
}

export function TopBarProjectName({ controller }: { controller: TopBarController }): JSX.Element {
  const { name, dirty } = controller.snapshot;
  const { documentActions } = controller.document;
  const { readiness } = controller.exportReadiness;
  const breadcrumb = buildBreadcrumb(controller);
  const tone = toneForGrade(readiness.grade);

  return (
    <div className="top-name-block">
      <div className="top-name-row">
        <input aria-label="Document name" value={name} onChange={(event) => { documentActions.updateName(event.target.value); }} className="doc-name-input doc-name-input--ux" />
        <span className={`top-dirty-dot ${dirty ? 'is-dirty' : 'is-clean'}`} aria-label={dirty ? 'Unsaved changes' : 'Saved'} />
      </div>
      <div className="top-meta-row">
        <span className={`top-status-pill top-status-pill--${tone}`} aria-label={`Readiness ${readiness.grade} ${readiness.score}%`}>
          <span className="status-dot" />
          <span>{readiness.grade} · {readiness.score}%</span>
        </span>
        <Tooltip content={breadcrumb}>
          <small className="top-project-breadcrumb" tabIndex={0}>{breadcrumb}</small>
        </Tooltip>
      </div>
    </div>
  );
}

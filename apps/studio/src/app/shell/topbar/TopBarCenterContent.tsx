import { CANVAS_PRESETS } from '../../../domain/document/canvas-presets';
import type { TopBarController } from './use-top-bar-controller';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Tooltip } from '../../../shared/ui/Tooltip';

function resolveCanvasLabel(presetId: string): string {
  return CANVAS_PRESETS.find((preset) => preset.id === presetId)?.label ?? 'Custom';
}

function buildBreadcrumb(controller: TopBarController): string {
  const parts = [
    controller.workspace.activeClient?.name ?? controller.snapshot.platformMeta?.clientName,
    controller.snapshot.platformMeta?.brandName,
    controller.snapshot.platformMeta?.campaignName,
  ].filter(Boolean);

  return parts.length ? parts.join(' / ') : 'Studio workspace';
}

export function TopBarCenterContent({ controller, onOpenAssets }: { controller: TopBarController; onOpenAssets: () => void }): JSX.Element {
  const { activeSceneId, scenes, canvasPresetId } = controller.snapshot;
  const { sceneActions } = controller.document;
  const canvasLabel = resolveCanvasLabel(canvasPresetId);
  const breadcrumb = buildBreadcrumb(controller);

  return (
    <div className="top-center-shell">
      <div className="top-scene-switcher" role="group" aria-label="Scene navigation">
        <button
          type="button"
          className="ghost compact-action top-scene-switcher__nav"
          onClick={() => sceneActions.previousScene()}
          aria-label="Previous scene"
        >
          <StudioIcon icon={StudioIcons.arrowLeft} size={14} />
        </button>
        <label className="top-scene-switcher__select">
          <span className="top-scene-switcher__label">Scene</span>
          <select value={activeSceneId} onChange={(event) => sceneActions.selectScene(event.target.value)} aria-label="Active scene">
            {scenes.map((scene, index) => (
              <option key={scene.id} value={scene.id}>
                {index + 1}. {scene.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ghost compact-action top-scene-switcher__nav"
          onClick={() => sceneActions.nextScene()}
          aria-label="Next scene"
        >
          <StudioIcon icon={StudioIcons.arrowRight} size={14} />
        </button>
      </div>

      <div className="top-center-meta">
        <span className="top-inline-pill top-inline-pill--canvas">
          <StudioIcon icon={StudioIcons.boxes} size={14} />
          {canvasLabel}
        </span>
        <Tooltip content={breadcrumb}>
          <span className="top-breadcrumb" tabIndex={0}>{breadcrumb}</span>
        </Tooltip>
      </div>

      <button type="button" className="ghost compact-action top-center-library" onClick={onOpenAssets}>
        <StudioIcon icon={StudioIcons.library} size={14} />
        Library
      </button>
    </div>
  );
}

import type { StudioState } from '../../domain/document/types';
import { buildPortableProjectExport } from '../portable';
import { buildExportRuntimeModelFromPortable } from '../runtime-model';
import { validatePortableExport } from '../compliance';

export type PlayableExportAdapterResult = {
  adapter: 'playable-ad';
  version: 1;
  exportedAt: string;
  playableProject: ReturnType<typeof buildPortableProjectExport>;
  runtimeModel: ReturnType<typeof buildExportRuntimeModelFromPortable>;
  compliance: ReturnType<typeof validatePortableExport>;
  bootstrap: {
    entrySceneId?: string;
    totalScenes: number;
    hasTapGesture: boolean;
    hasDragGesture: boolean;
    clickthroughs: Array<{ widgetId: string; url: string }>;
  };
};

export function buildPlayableExportAdapter(state: StudioState): PlayableExportAdapterResult {
  const playableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(playableProject);
  const compliance = validatePortableExport(playableProject);
  const gestures = runtimeModel.scenes.flatMap((scene) => scene.widgets.flatMap((widget) => widget.gestures));
  const clickthroughs = playableProject.interactions
    .filter((interaction) => interaction.type === 'open-url' && interaction.url)
    .map((interaction) => ({ widgetId: interaction.widgetId, url: interaction.url! }));

  return {
    adapter: 'playable-ad',
    version: 1,
    exportedAt: new Date().toISOString(),
    playableProject,
    runtimeModel,
    compliance,
    bootstrap: {
      entrySceneId: playableProject.scenes[0]?.id,
      totalScenes: playableProject.scenes.length,
      hasTapGesture: gestures.includes('tap'),
      hasDragGesture: gestures.includes('drag'),
      clickthroughs,
    },
  };
}

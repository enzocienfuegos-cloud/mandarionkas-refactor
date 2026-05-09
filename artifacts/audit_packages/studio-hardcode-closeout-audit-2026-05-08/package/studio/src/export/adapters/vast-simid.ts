import type { StudioState } from '../../domain/document/types';
import { validatePortableExport } from '../compliance';
import { buildPortableProjectExport } from '../portable';
import { buildExportRuntimeModelFromPortable } from '../runtime-model';

export type VastSimidAdapterResult = {
  adapter: 'vast-simid';
  version: 1;
  exportedAt: string;
  portableProject: ReturnType<typeof buildPortableProjectExport>;
  runtimeModel: ReturnType<typeof buildExportRuntimeModelFromPortable>;
  compliance: ReturnType<typeof validatePortableExport>;
  simid: {
    vastVersion: '4.2';
    entry: 'index.html';
    interactiveCreativeType: 'text/html';
    durationSeconds: number;
    skipOffset: number;
  };
};

export function buildVastSimidAdapter(state: StudioState): VastSimidAdapterResult {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const totalDurationMs = portableProject.scenes.reduce((sum, scene) => sum + scene.durationMs, 0);
  const durationSeconds = Math.max(1, Math.round(totalDurationMs / 1000));

  return {
    adapter: 'vast-simid',
    version: 1,
    exportedAt: new Date().toISOString(),
    portableProject,
    runtimeModel,
    compliance: validatePortableExport(portableProject),
    simid: {
      vastVersion: '4.2',
      entry: 'index.html',
      interactiveCreativeType: 'text/html',
      durationSeconds,
      skipOffset: 5,
    },
  };
}

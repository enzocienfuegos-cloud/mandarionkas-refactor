import type { StudioState } from '../../domain/document/types';
import { buildPortableProjectExport } from '../portable';
import { buildExportRuntimeModelFromPortable } from '../runtime-model';
import { validatePortableExport } from '../compliance';
import { getPortableChannelRequirements } from '../channel-compliance';

export type GoogleDisplayAdapterResult = {
  adapter: 'google-display';
  version: 1;
  exportedAt: string;
  portableProject: ReturnType<typeof buildPortableProjectExport>;
  runtimeModel: ReturnType<typeof buildExportRuntimeModelFromPortable>;
  compliance: ReturnType<typeof validatePortableExport>;
  channelChecklist: ReturnType<typeof getPortableChannelRequirements>;
  display: {
    entry: 'index.html';
    standardSize: boolean;
    maxRecommendedScenes: number;
  };
};

export function buildGoogleDisplayAdapter(state: StudioState): GoogleDisplayAdapterResult {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const standardSize = [[300, 250], [300, 600], [970, 250], [320, 480]]
    .some(([w, h]) => portableProject.canvas.width === w && portableProject.canvas.height === h);

  return {
    adapter: 'google-display',
    version: 1,
    exportedAt: new Date().toISOString(),
    portableProject,
    runtimeModel,
    compliance: validatePortableExport(portableProject),
    channelChecklist: getPortableChannelRequirements('google-display', portableProject, runtimeModel),
    display: {
      entry: 'index.html',
      standardSize,
      maxRecommendedScenes: 3,
    },
  };
}

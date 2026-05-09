import type { StudioState } from '../../domain/document/types';
import { buildPortableProjectExport } from '../portable';
import { buildExportRuntimeModelFromPortable } from '../runtime-model';
import { validatePortableExport } from '../compliance';
import { getPortableChannelRequirements } from '../channel-compliance';

export type GamHtml5AdapterResult = {
  adapter: 'gam-html5';
  version: 1;
  exportedAt: string;
  portableProject: ReturnType<typeof buildPortableProjectExport>;
  runtimeModel: ReturnType<typeof buildExportRuntimeModelFromPortable>;
  compliance: ReturnType<typeof validatePortableExport>;
  channelChecklist: ReturnType<typeof getPortableChannelRequirements>;
  html5: {
    entry: 'index.html';
    requiresClickTag: true;
    supportsPoliteLoad: true;
    requiresSingleRootDocument: true;
  };
};

export function buildGamHtml5Adapter(state: StudioState): GamHtml5AdapterResult {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  return {
    adapter: 'gam-html5',
    version: 1,
    exportedAt: new Date().toISOString(),
    portableProject,
    runtimeModel,
    compliance: validatePortableExport(portableProject),
    channelChecklist: getPortableChannelRequirements('gam-html5', portableProject, runtimeModel),
    html5: {
      entry: 'index.html',
      requiresClickTag: true,
      supportsPoliteLoad: true,
      requiresSingleRootDocument: true,
    },
  };
}

import type { StudioState } from '../../domain/document/types';
import { buildPortableProjectExport } from '../portable';
import { buildExportRuntimeModelFromPortable } from '../runtime-model';
import { validatePortableExport } from '../compliance';
import { getPortableChannelRequirements } from '../channel-compliance';

export type MraidAdapterResult = {
  adapter: 'mraid';
  version: 1;
  exportedAt: string;
  portableProject: ReturnType<typeof buildPortableProjectExport>;
  runtimeModel: ReturnType<typeof buildExportRuntimeModelFromPortable>;
  compliance: ReturnType<typeof validatePortableExport>;
  channelChecklist: ReturnType<typeof getPortableChannelRequirements>;
  mraid: {
    entry: 'index.html';
    supportedSizes: Array<'320x480' | '300x600'>;
    standardSize: boolean;
    placement: 'inline' | 'interstitial';
    apiVersion: '3.0';
    requiresMraidOpen: true;
    supportsLocation: true;
  };
};

export function buildMraidAdapter(state: StudioState): MraidAdapterResult {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const sizeKey = `${portableProject.canvas.width}x${portableProject.canvas.height}`;
  const standardSize = sizeKey === '320x480' || sizeKey === '300x600';
  const placement = sizeKey === '320x480' ? 'interstitial' : 'inline';

  return {
    adapter: 'mraid',
    version: 1,
    exportedAt: new Date().toISOString(),
    portableProject,
    runtimeModel,
    compliance: validatePortableExport(portableProject),
    channelChecklist: getPortableChannelRequirements('mraid', portableProject, runtimeModel),
    mraid: {
      entry: 'index.html',
      supportedSizes: ['320x480', '300x600'],
      standardSize,
      placement,
      apiVersion: '3.0',
      requiresMraidOpen: true,
      supportsLocation: true,
    },
  };
}

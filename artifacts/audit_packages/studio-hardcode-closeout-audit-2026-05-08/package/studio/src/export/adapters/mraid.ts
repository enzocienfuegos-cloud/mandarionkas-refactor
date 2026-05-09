import type { StudioState } from '../../domain/document/types';
import { buildPortableProjectExport } from '../portable';
import { buildExportRuntimeModelFromPortable } from '../runtime-model';
import { validatePortableExport } from '../compliance';
import { getPortableChannelRequirements } from '../channel-compliance';
import { getMraidStandardPresets, getPresetForSize } from '../../domain/document/canvas-presets';

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
    supportedSizes: string[];
    standardSize: boolean;
    placement: 'inline' | 'interstitial' | 'banner';
    apiVersion: '3.0';
    requiresMraidOpen: true;
    requiredHostFeatures: {
      open: true;
      location: boolean;
    };
    expectedHost: {
      placementType: 'inline' | 'interstitial' | 'banner';
      maxSize: { width: number; height: number };
    };
  };
};

export function buildMraidAdapter(state: StudioState): MraidAdapterResult {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  const sizeKey = `${portableProject.canvas.width}x${portableProject.canvas.height}`;
  const matchingPreset = getPresetForSize(portableProject.canvas.width, portableProject.canvas.height);
  const standardSize = Boolean(matchingPreset?.mraidStandard);
  const placement = matchingPreset?.mraidPlacement ?? (sizeKey === '320x480' ? 'interstitial' : 'inline');
  const requiresLocation = portableProject.scenes.some((scene) =>
    scene.widgets.some((widget) => widget.type === 'dynamic-map' && Boolean(widget.props.requestUserLocation ?? false)),
  );

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
      supportedSizes: getMraidStandardPresets().map((preset) => `${preset.width}x${preset.height}`),
      standardSize,
      placement,
      apiVersion: '3.0',
      requiresMraidOpen: true,
      requiredHostFeatures: {
        open: true,
        location: requiresLocation,
      },
      expectedHost: {
        placementType: placement,
        maxSize: {
          width: portableProject.canvas.width,
          height: portableProject.canvas.height,
        },
      },
    },
  };
}

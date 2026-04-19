import { createInitialState } from '../../../domain/document/factories';
import type { StudioState } from '../../../domain/document/types';
import { createWorldCupStarterState } from './world-cup-starter';

export type ProjectStarterId = 'blank' | 'bocadeli-worldcup';

export type ProjectStarterOption = {
  id: ProjectStarterId;
  label: string;
  description: string;
  canvasPresetId?: string;
};

export const PROJECT_STARTERS: ProjectStarterOption[] = [
  {
    id: 'blank',
    label: 'Blank canvas',
    description: 'Start from a clean project and pick any canvas size.',
  },
  {
    id: 'bocadeli-worldcup',
    label: 'Bocadeli World Cup starter',
    description: 'Seeds the World Cup interactive layout with configurable game widgets on 320×480.',
    canvasPresetId: 'interstitial',
  },
];

type StarterOptions = {
  starterId: ProjectStarterId;
  name: string;
  canvasPresetId: string;
  clientId?: string;
  clientName?: string;
  brandName?: string;
  campaignName?: string;
};

function applyProjectPlatformMeta(state: StudioState, options: StarterOptions): StudioState {
  return {
    ...state,
    document: {
      ...state.document,
      metadata: {
        ...state.document.metadata,
        platform: {
          ...(state.document.metadata.platform ?? {}),
          clientId: options.clientId,
          clientName: options.clientName ?? '',
          brandName: options.brandName ?? '',
          campaignName: options.campaignName ?? '',
        },
      },
    },
  };
}

export function createProjectStarterState(options: StarterOptions): StudioState {
  if (options.starterId === 'bocadeli-worldcup') {
    return createWorldCupStarterState(options);
  }
  return applyProjectPlatformMeta(
    createInitialState({
      name: options.name,
      canvasPresetId: options.canvasPresetId,
    }),
    options,
  );
}

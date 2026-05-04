import { createInitialState } from '../../../domain/document/factories';
import type { StudioState } from '../../../domain/document/types';

export type ProjectStarterId = 'blank' | string;

export type ProjectStarterOption = {
  id: ProjectStarterId;
  label: string;
  description: string;
  canvasPresetId?: string;
};

const BUILT_IN_STARTERS: ProjectStarterOption[] = [
  {
    id: 'blank',
    label: 'Blank canvas',
    description: 'Start from a clean project and pick any canvas size.',
  },
];

const extraStarters: ProjectStarterOption[] = [];

type StarterOptions = {
  starterId: ProjectStarterId;
  name: string;
  canvasPresetId: string;
  clientId?: string;
  clientName?: string;
  brandName?: string;
  campaignName?: string;
};

type StarterHandlerFn = (options: StarterOptions) => StudioState;
const starterHandlers = new Map<string, StarterHandlerFn>();

export function registerProjectStarter(option: ProjectStarterOption): void {
  if (extraStarters.some((starter) => starter.id === option.id)) return;
  extraStarters.push(option);
}

export function getProjectStarters(): ProjectStarterOption[] {
  return [...BUILT_IN_STARTERS, ...extraStarters];
}

export function registerProjectStarterHandler(id: string, handler: StarterHandlerFn): void {
  starterHandlers.set(id, handler);
}

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
  const handler = starterHandlers.get(options.starterId);
  if (handler) {
    return handler(options);
  }
  return applyProjectPlatformMeta(
    createInitialState({
      name: options.name,
      canvasPresetId: options.canvasPresetId,
    }),
    options,
  );
}

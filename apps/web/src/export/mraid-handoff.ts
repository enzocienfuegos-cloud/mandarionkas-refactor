import type { StudioState } from '../domain/document/types';
import { getChannelRequirements } from './channels';

export type MraidHostFeature = 'open' | 'location';

export type MraidHandoff = {
  apiVersion: '3.0';
  placementType: 'inline' | 'interstitial';
  supportedSizes: Array<{ width: number; height: number }>;
  standardSize: { width: number; height: number };
  requiredHostFeatures: MraidHostFeature[];
  readyForHostHandoff: boolean;
  blockers: string[];
  warnings: string[];
};

function hasWidget(state: StudioState, widgetType: string): boolean {
  return Object.values(state.document.widgets).some((widget) => widget.type === widgetType);
}

export function usesLocationAwareExperience(state: StudioState): boolean {
  return hasWidget(state, 'dynamic-map');
}

export function getExpectedMraidPlacementType(state: StudioState): 'inline' | 'interstitial' {
  return state.document.canvas.width === 320 && state.document.canvas.height === 480 ? 'interstitial' : 'inline';
}

export function getRequiredMraidHostFeatures(state: StudioState): MraidHostFeature[] {
  const required = new Set<MraidHostFeature>(['open']);
  if (usesLocationAwareExperience(state)) required.add('location');
  return [...required];
}

export function buildMraidHandoff(state: StudioState): MraidHandoff {
  const checklist = getChannelRequirements('mraid', state);
  const blockers = checklist.filter((item) => item.severity === 'error' && !item.passed).map((item) => item.label);
  const warnings = checklist.filter((item) => item.severity !== 'error' && !item.passed).map((item) => item.label);
  return {
    apiVersion: '3.0',
    placementType: getExpectedMraidPlacementType(state),
    supportedSizes: [
      { width: 300, height: 600 },
      { width: 320, height: 480 },
    ],
    standardSize: {
      width: state.document.canvas.width,
      height: state.document.canvas.height,
    },
    requiredHostFeatures: getRequiredMraidHostFeatures(state),
    readyForHostHandoff: blockers.length === 0,
    blockers,
    warnings,
  };
}

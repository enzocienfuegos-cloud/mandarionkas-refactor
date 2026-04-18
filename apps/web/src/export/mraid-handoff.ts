import type { StudioState } from '../domain/document/types';
import { getChannelRequirements } from './channels';
import { summarizeMraidCompatibility } from './mraid-compatibility';

export type MraidHostFeature = 'open' | 'location';

export type MraidHandoff = {
  apiVersion: '3.0';
  placementType: 'inline' | 'interstitial';
  supportedSizes: Array<{ width: number; height: number }>;
  standardSize: { width: number; height: number };
  requiredHostFeatures: MraidHostFeature[];
  expectedHost: {
    placementType: 'inline' | 'interstitial';
    supportsLocation: boolean;
  };
  moduleCompatibility: {
    supported: string[];
    warning: Array<{ widgetId: string; widgetType: string; reason: string }>;
    blocked: Array<{ widgetId: string; widgetType: string; reason: string }>;
    summary: {
      totalWidgets: number;
      warningCount: number;
      blockedCount: number;
    };
  };
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
  const compatibility = summarizeMraidCompatibility(state);
  const widgetIds = Object.values(state.document.widgets).map((widget) => widget.id);
  const warnedIds = new Set(compatibility.warnings.map((item) => item.widgetId));
  const blockedIds = new Set(compatibility.blockers.map((item) => item.widgetId));
  const blockers = [
    ...checklist.filter((item) => item.severity === 'error' && !item.passed).map((item) => item.label),
    ...compatibility.blockers.map((item) => item.reason),
  ];
  const warnings = [
    ...checklist.filter((item) => item.severity !== 'error' && !item.passed).map((item) => item.label),
    ...compatibility.warnings.map((item) => item.reason),
  ];
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
    expectedHost: {
      placementType: getExpectedMraidPlacementType(state),
      supportsLocation: usesLocationAwareExperience(state),
    },
    moduleCompatibility: {
      supported: widgetIds.filter((id) => !warnedIds.has(id) && !blockedIds.has(id)),
      warning: compatibility.warnings.map((item) => ({ widgetId: item.widgetId, widgetType: item.widgetType, reason: item.reason })),
      blocked: compatibility.blockers.map((item) => ({ widgetId: item.widgetId, widgetType: item.widgetType, reason: item.reason })),
      summary: {
        totalWidgets: widgetIds.length,
        warningCount: compatibility.warnings.length,
        blockedCount: compatibility.blockers.length,
      },
    },
    readyForHostHandoff: blockers.length === 0,
    blockers,
    warnings,
  };
}

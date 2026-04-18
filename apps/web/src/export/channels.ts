import type { ReleaseTarget, StudioState } from '../domain/document/types';
import { getExportChannelProfile } from './adapters';
import { summarizeMraidCompatibility, type MraidWidgetCompatibilityIssue } from './mraid-compatibility';
import { usesLocationAwareExperience } from './mraid-handoff';
import type { ChannelRequirement } from './types';

export function getChannelRequirements(target: ReleaseTarget, state: StudioState): ChannelRequirement[] {
  const requirements = getExportChannelProfile(target).getRequirements(state);
  if (target === 'mraid') {
    const compatibility = summarizeMraidCompatibility(state);
    if (compatibility.blockers.length) {
      requirements.push({
        id: 'mraid-module-blockers',
        label: `No blocked MRAID widgets (${compatibility.blockers.map((item: MraidWidgetCompatibilityIssue) => item.widgetType).join(', ')})`,
        passed: false,
        severity: 'error',
      });
    }
    if (compatibility.warnings.length) {
      requirements.push({
        id: 'mraid-module-warnings',
        label: `Warning-only MRAID widgets reviewed (${compatibility.warnings.map((item: MraidWidgetCompatibilityIssue) => item.widgetType).join(', ')})`,
        passed: false,
        severity: 'warning',
      });
    }
  }
  if (target === 'mraid' && usesLocationAwareExperience(state)) {
    requirements.push({
      id: 'mraid-host-location',
      label: 'Host supports MRAID location for locator experiences',
      passed: false,
      severity: 'warning',
    });
  }
  return requirements;
}

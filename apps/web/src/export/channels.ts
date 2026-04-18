import type { ReleaseTarget, StudioState } from '../domain/document/types';
import { getExportChannelProfile } from './adapters';
import { usesLocationAwareExperience } from './mraid-handoff';
import type { ChannelRequirement } from './types';

export function getChannelRequirements(target: ReleaseTarget, state: StudioState): ChannelRequirement[] {
  const requirements = getExportChannelProfile(target).getRequirements(state);
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

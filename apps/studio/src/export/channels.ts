import type { ReleaseTarget, StudioState } from '../domain/document/types';
import type { ChannelRequirement } from './types';
import { buildPortableProjectExport } from './portable';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { getPortableChannelRequirements } from './channel-compliance';

export function getChannelRequirements(target: ReleaseTarget, state: StudioState): ChannelRequirement[] {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  return getPortableChannelRequirements(target, portableProject, runtimeModel);
}

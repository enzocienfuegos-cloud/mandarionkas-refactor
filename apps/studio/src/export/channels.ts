import type { ReleaseTarget, StudioState } from '../domain/document/types';
import type { ChannelRequirement } from './types';
import type { BudgetMeasurement } from './channel-budgets';
import { buildPortableProjectExport } from './portable';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { getPortableChannelRequirements } from './channel-compliance';

export function getChannelRequirements(
  target: ReleaseTarget,
  state: StudioState,
  measurement?: BudgetMeasurement,
): ChannelRequirement[] {
  const portableProject = buildPortableProjectExport(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(portableProject);
  return getPortableChannelRequirements(target, portableProject, runtimeModel, measurement);
}

import type { AnimationTrigger } from '../../motion/animation-engine/events';

export const DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD = 30;
export const MAX_SCRATCH_MILESTONES = 5;

export type ScratchMilestone = {
  id: string;
  thresholdPercent: number;
  emitTrigger: AnimationTrigger;
};

export const DEFAULT_SCRATCH_MILESTONES: readonly ScratchMilestone[] = Object.freeze([]);

export function generateScratchMilestoneId(): string {
  return `ms_${Math.random().toString(36).slice(2, 10)}`;
}

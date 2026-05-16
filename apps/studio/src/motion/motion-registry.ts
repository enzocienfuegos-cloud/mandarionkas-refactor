import { discoveredHoverMotionTemplates, discoveredMotionTemplates } from './motion-auto-discovery';
import type { MotionTemplate } from './motion-template-contract';

const motionRegistry = new Map<string, MotionTemplate>(discoveredMotionTemplates.map((template) => [template.id, template]));
const hoverMotionRegistry = new Map<string, MotionTemplate>(discoveredHoverMotionTemplates.map((template) => [template.id, template]));

export function listMotionTemplates(): MotionTemplate[] {
  return [...motionRegistry.values()];
}

export function listHoverMotionTemplates(): MotionTemplate[] {
  return [...hoverMotionRegistry.values()];
}

export function getMotionTemplate(templateId: string | null | undefined): MotionTemplate | undefined {
  if (!templateId) return undefined;
  return motionRegistry.get(templateId);
}

export function getHoverMotionTemplate(templateId: string | null | undefined): MotionTemplate | undefined {
  if (!templateId) return undefined;
  return hoverMotionRegistry.get(templateId);
}

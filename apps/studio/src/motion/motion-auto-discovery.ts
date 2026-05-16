import type { MotionTemplate } from './motion-template-contract';

type MotionModule = { default?: MotionTemplate } & Record<string, MotionTemplate | undefined>;

function readMotionTemplates(modules: Record<string, MotionModule>): MotionTemplate[] {
  return Object.values(modules)
    .flatMap((module) => {
      const direct = module.default ? [module.default] : [];
      const named = Object.values(module).filter((value): value is MotionTemplate => Boolean(value?.id));
      return [...direct, ...named];
    })
    .filter((template, index, templates) => templates.findIndex((candidate) => candidate.id === template.id) === index)
    .sort((left, right) => left.label.localeCompare(right.label));
}

const entranceModules = import.meta.glob<MotionModule>('./templates/*.motion.ts', { eager: true });
const hoverModules = import.meta.glob<MotionModule>('./hover/*.hover.ts', { eager: true });

export const discoveredMotionTemplates = readMotionTemplates(entranceModules);
export const discoveredHoverMotionTemplates = readMotionTemplates(hoverModules);

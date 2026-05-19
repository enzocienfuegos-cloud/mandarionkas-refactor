import type { WidgetNode } from '../../domain/document/types';
import type { AnimationPlan, PlanContext } from '../../motion/animation-engine/plan';
import { BaseGsapAnimationEngine } from '../../motion/animation-engine/gsap-engine-base';

export class RuntimeAnimationEngine extends BaseGsapAnimationEngine {
  buildPlansForWidget(_widget: WidgetNode, _context: PlanContext): readonly AnimationPlan[] {
    return [];
  }
}

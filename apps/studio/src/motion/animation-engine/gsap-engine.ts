import type { WidgetNode } from '../../domain/document/types';
import type { AnimationPlan, PlanContext } from './plan';
import { derivePlansForWidget } from './plan';
import { BaseGsapAnimationEngine } from './gsap-engine-base';

export class GsapAnimationEngine extends BaseGsapAnimationEngine {
  buildPlansForWidget(widget: WidgetNode, context: PlanContext): readonly AnimationPlan[] {
    return derivePlansForWidget(widget, context);
  }
}

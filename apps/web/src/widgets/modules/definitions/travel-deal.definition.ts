import { createModuleDefinition } from '../module-definition-factory';
import { renderTravelDealStage } from '../travel-deal.renderer';

export const TravelDealDefinition = createModuleDefinition({
  type: 'travel-deal',
  label: 'Travel Deal',
  category: 'interactive',
  frame: { x: 80, y: 50, width: 220, height: 126, rotation: 0 },
  props: { title: 'Travel Deal', destination: 'Madrid', price: '$499', ctaLabel: 'Book now' },
  style: { backgroundColor: '#f8fafc', accentColor: '#3b82f6', color: '#0f172a' },
  renderStage: renderTravelDealStage,
});

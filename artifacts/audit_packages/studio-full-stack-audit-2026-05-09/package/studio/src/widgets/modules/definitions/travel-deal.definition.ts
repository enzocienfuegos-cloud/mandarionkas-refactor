import { createModuleDefinition } from '../module-definition-factory';
import { TRAVEL_DEAL_DEFAULT_PROPS } from '../travel-deal.shared';
import { renderTravelDealStage } from '../travel-deal.renderer';
import { TravelDealThumb } from '../../registry/widget-thumbnails';

export const TravelDealDefinition = createModuleDefinition({
  type: 'travel-deal',
  label: 'Travel Deal',
  category: 'interactive',
  thumbnail: TravelDealThumb,
  frame: { x: 80, y: 50, width: 220, height: 126, rotation: 0 },
  props: TRAVEL_DEAL_DEFAULT_PROPS,
  style: { backgroundColor: '#f8fafc', accentColor: '#3b82f6', color: '#0f172a' },
  renderStage: renderTravelDealStage,
});

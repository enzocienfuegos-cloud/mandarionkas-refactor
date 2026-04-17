import { createModuleDefinition } from '../module-definition-factory';
import { renderAddtoCalendarStage } from '../add-to-calendar.renderer';

export const AddToCalendarDefinition = createModuleDefinition({
  type: 'add-to-calendar',
  label: 'Add to Calendar',
  category: 'interactive',
  frame: { x: 80, y: 70, width: 240, height: 110, rotation: 0 },
  props: { title: 'Add to Calendar', eventName: 'Product Launch', date: '2026-05-01 18:00' },
  style: { backgroundColor: '#0f172a', accentColor: '#ef4444', color: '#ffffff' },
  renderStage: renderAddtoCalendarStage,
});

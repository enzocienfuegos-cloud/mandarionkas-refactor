import { createModuleDefinition } from '../module-definition-factory';
import { renderShoppableSidebarStage } from '../shoppable-sidebar.renderer';

export const ShoppableSidebarDefinition = createModuleDefinition({
  type: 'shoppable-sidebar',
  label: 'Shoppable Sidebar',
  category: 'interactive',
  frame: { x: 80, y: 50, width: 250, height: 136, rotation: 0 },
  props: { title: 'Shop the look', itemOne: 'Bag', itemTwo: 'Shoes', orientation: 'vertical' },
  style: { backgroundColor: '#f8fafc', accentColor: '#9a3412', color: '#1f2937' },
  renderStage: renderShoppableSidebarStage,
});

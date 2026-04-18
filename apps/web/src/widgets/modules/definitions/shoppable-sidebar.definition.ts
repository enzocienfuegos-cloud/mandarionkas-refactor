import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderShoppableSidebarStage } from '../shoppable-sidebar.renderer';
import { ShoppableSidebarInspector } from '../shoppable-sidebar.inspector';

export const ShoppableSidebarDefinition = createModuleDefinition({
  type: 'shoppable-sidebar',
  label: 'Shoppable Sidebar',
  category: 'interactive',
  frame: { x: 80, y: 50, width: 320, height: 180, rotation: 0 },
  props: {
    title: 'Shop the look',
    products: '',
    assetIdsCsv: '',
    itemCount: 2,
    activeIndex: 1,
    orientation: 'horizontal',
    cardShape: 'portrait',
    autoscroll: true,
    intervalMs: 2600,
  },
  renderInspector: (widget) => createElement(ShoppableSidebarInspector, { widget }),
  style: { backgroundColor: '#f8fafc', accentColor: '#9a3412', color: '#1f2937', borderRadius: 20 },
  renderStage: renderShoppableSidebarStage,
});

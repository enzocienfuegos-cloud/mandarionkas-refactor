import { createModuleDefinition } from '../module-definition-factory';
import { renderInteractiveHotspotStage } from '../interactive-hotspot.renderer';
import { renderInteractiveHotspotExport } from '../../registry/base-exporters';

export const InteractiveHotspotDefinition = createModuleDefinition({
  type: 'interactive-hotspot',
  label: 'Interactive Hotspot',
  category: 'interactive',
  frame: { x: 120, y: 80, width: 220, height: 116, rotation: 0 },
  props: { title: 'Hotspot', label: 'Tap point', pulse: true, hotspotX: 55, hotspotY: 45 },
  style: { backgroundColor: '#172554', accentColor: '#f59e0b', color: '#ffffff' },
  renderStage: renderInteractiveHotspotStage,
  renderExport: (node) => renderInteractiveHotspotExport(node),
});

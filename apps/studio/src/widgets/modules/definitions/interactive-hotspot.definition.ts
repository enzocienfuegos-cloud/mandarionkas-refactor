import { createModuleDefinition } from '../module-definition-factory';
import { renderInteractiveHotspotStage } from '../interactive-hotspot.renderer';

export const InteractiveHotspotDefinition = createModuleDefinition({
  type: 'interactive-hotspot',
  label: 'Interactive Hotspot',
  category: 'interactive',
  frame: { x: 120, y: 80, width: 220, height: 116, rotation: 0 },
  props: {
    title: 'Hotspot',
    label: 'Tap point',
    header: 'Interactive hotspot',
    body: 'Add more context for this interactive point.',
    pulse: true,
    hotspotX: 55,
    hotspotY: 45,
    hotspotShape: 'circle',
    hotspotIcon: 'plus',
    hotspotEffect: 'pulse',
    autoCloseMs: 2000,
  },
  inspectorFields: [
    { key: 'title' },
    { key: 'label', label: 'Badge label' },
    { key: 'header', label: 'Card header' },
    { key: 'body', label: 'Card body', type: 'textarea' },
    { key: 'hotspotX', label: 'Hotspot X', type: 'number' },
    { key: 'hotspotY', label: 'Hotspot Y', type: 'number' },
    {
      key: 'hotspotShape',
      type: 'select',
      options: [
        { label: 'Circle', value: 'circle' },
        { label: 'Square', value: 'square' },
        { label: 'Pill', value: 'pill' },
        { label: 'Diamond', value: 'diamond' },
      ],
    },
    {
      key: 'hotspotIcon',
      type: 'select',
      options: [
        { label: 'Plus', value: 'plus' },
        { label: 'Arrow up', value: 'arrow-up' },
        { label: 'Arrow down', value: 'arrow-down' },
        { label: 'Arrow left', value: 'arrow-left' },
        { label: 'Arrow right', value: 'arrow-right' },
        { label: 'Info', value: 'info' },
      ],
    },
    {
      key: 'hotspotEffect',
      type: 'select',
      options: [
        { label: 'Pulse', value: 'pulse' },
        { label: 'Bounce', value: 'bounce' },
        { label: 'Ping', value: 'ping' },
        { label: 'None', value: 'none' },
      ],
    },
    { key: 'autoCloseMs', label: 'Auto-close ms', type: 'number' },
  ],
  style: { backgroundColor: 'transparent', accentColor: '#f59e0b', color: '#ffffff' },
  renderStage: renderInteractiveHotspotStage,
});

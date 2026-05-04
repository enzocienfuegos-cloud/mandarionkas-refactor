import { createModuleDefinition } from '../module-definition-factory';
import { renderSpeedTestExport } from '../export-renderers';
import { renderSpeedTestStage } from '../speed-test.renderer';

export const SpeedTestDefinition = createModuleDefinition({
  type: 'speed-test',
  label: 'Speed Test',
  category: 'interactive',
  frame: { x: 80, y: 60, width: 220, height: 116, rotation: 0 },
  props: {
    title: 'Speed Test',
    min: 10,
    max: 100,
    current: 64,
    units: 'Mbps',
    skin: 'ookla',
    pingValue: 11,
    uploadValue: 42,
    durationMs: 1800,
    ctaLabel: 'Start test',
    resultMode: 'random',
    fastThreshold: 70,
    fastMessage: 'WOW, very fast network',
    slowMessage: 'Slow connection',
  },
  inspectorFields: [
    { key: 'title' },
    { key: 'min', type: 'number' },
    { key: 'max', type: 'number' },
    { key: 'current', label: 'Fixed result', type: 'number' },
    { key: 'units' },
    { key: 'pingValue', label: 'Ping', type: 'number' },
    { key: 'uploadValue', label: 'Upload', type: 'number' },
    {
      key: 'skin',
      type: 'select',
      options: [
        { label: 'Ookla style', value: 'ookla' },
        { label: 'Fast style', value: 'fast' },
        { label: 'Classic', value: 'classic' },
      ],
    },
    { key: 'durationMs', label: 'Duration ms', type: 'number' },
    { key: 'ctaLabel', label: 'Button label' },
    { key: 'fastThreshold', label: 'Fast threshold', type: 'number' },
    { key: 'fastMessage', label: 'Fast message' },
    { key: 'slowMessage', label: 'Slow message' },
    {
      key: 'resultMode',
      label: 'Result mode',
      type: 'select',
      options: [
        { label: 'Random', value: 'random' },
        { label: 'Fixed', value: 'fixed' },
      ],
    },
  ],
  style: { backgroundColor: '#0b3b7a', accentColor: '#2dd4bf', color: '#ffffff' },
  renderStage: renderSpeedTestStage,
  renderExport: (node) => renderSpeedTestExport(node),
});

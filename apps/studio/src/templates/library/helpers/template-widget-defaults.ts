import { createId } from '../../../domain/document/factories';
import type { WidgetNode, WidgetType } from '../../../domain/document/types';

type TemplateWidgetDefaults = Pick<WidgetNode, 'name' | 'frame' | 'props' | 'style' | 'timeline'>;

function createTemplateWidgetDefaults(type: WidgetType): TemplateWidgetDefaults {
  switch (type) {
    case 'shape':
      return {
        name: 'Shape',
        frame: { x: 320, y: 40, width: 180, height: 80, rotation: 0 },
        props: { shape: 'rectangle', maskSrc: '', maskAssetId: '', maskFit: 'cover', maskFocalX: 50, maskFocalY: 50 },
        style: { backgroundColor: '#f6a11c' },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'text':
      return {
        name: 'Text',
        frame: { x: 40, y: 40, width: 280, height: 80, rotation: 0 },
        props: { text: 'New text block' },
        style: { color: '#ffffff', fontSize: 28, fontWeight: 700 },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'image':
      return {
        name: 'Image',
        frame: { x: 40, y: 140, width: 260, height: 140, rotation: 0 },
        props: { src: '', alt: 'Placeholder image' },
        style: { backgroundColor: '#324454', fit: 'cover' },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'cta':
      return {
        name: 'CTA',
        frame: { x: 360, y: 180, width: 240, height: 44, rotation: 0 },
        props: { text: 'Learn more', url: '' },
        style: { color: '#10161c', backgroundColor: '#ffd400', fontSize: 24, fontWeight: 700 },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'badge':
      return {
        name: 'Badge',
        frame: { x: 40, y: 40, width: 180, height: 44, rotation: 0 },
        props: { text: 'New badge', icon: '★' },
        style: {
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 800,
          backgroundColor: '#7c3aed',
          borderRadius: 999,
          borderColor: 'rgba(255,255,255,0.18)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
        },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'step-indicator':
      return {
        name: 'Step Indicator',
        frame: { x: 40, y: 40, width: 120, height: 24, rotation: 0 },
        props: { total: 3, current: 1, doneColor: '#ffffff', pendingColor: 'rgba(255,255,255,0.3)', size: 10, gap: 10 },
        style: { backgroundColor: 'transparent', accentColor: '#ffffff', color: '#ffffff' },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'particle-halo':
      return {
        name: 'Particle Halo',
        frame: { x: 50, y: 50, width: 160, height: 160, rotation: 0 },
        props: { size: 160, radius: 64, count: 12, colorA: '#ffffff', colorB: '#00c9ff', pulseMs: 1800 },
        style: { backgroundColor: 'transparent', accentColor: '#00c9ff', color: '#ffffff' },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'drop-zone':
      return {
        name: 'Drop Zone',
        frame: { x: 60, y: 60, width: 140, height: 140, rotation: 0 },
        props: { acceptsSource: '', hitPadding: 16, width: 120, height: 120, debugOutline: true, onMatchAction: '', anchorWidgetId: '' },
        style: { backgroundColor: 'transparent', accentColor: '#00e5ff', color: '#ffffff' },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'timer-bar':
      return {
        name: 'Timer Bar',
        frame: { x: 20, y: 20, width: 280, height: 12, rotation: 0 },
        props: { durationMs: 7000, orientation: 'horizontal', fillColor: '#00e5ff', trackColor: 'rgba(255,255,255,0.2)', borderRadius: 4, thickness: 8 },
        style: { backgroundColor: 'transparent', accentColor: '#00e5ff', color: '#ffffff' },
        timeline: { startMs: 0, endMs: 15000 },
      };
    case 'drag-token-pool':
      return {
        name: 'Drag Token Pool',
        frame: { x: 20, y: 20, width: 280, height: 96, rotation: 0 },
        props: { tokens: [], disabledIds: [], dropTargetId: '', tokenSize: 72, gap: 16, tokenShape: 'circle' },
        style: { backgroundColor: 'transparent', accentColor: '#ffffff', color: '#ffffff' },
        timeline: { startMs: 0, endMs: 15000 },
      };
    default:
      return {
        name: type,
        frame: { x: 40, y: 40, width: 200, height: 80, rotation: 0 },
        props: {},
        style: {},
        timeline: { startMs: 0, endMs: 15000 },
      };
  }
}

export function createTemplateWidgetSeed(type: WidgetType, sceneId: string, zIndex: number): WidgetNode {
  const defaults = createTemplateWidgetDefaults(type);
  return {
    id: createId(type.replace(/[^a-z]/g, '') || 'widget'),
    type,
    name: defaults.name,
    sceneId,
    zIndex,
    frame: { ...defaults.frame },
    props: { ...defaults.props },
    style: { ...defaults.style },
    timeline: { ...defaults.timeline },
  };
}

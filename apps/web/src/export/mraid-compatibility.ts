import type { WidgetType } from '../domain/document/types';
import type { PortableExportProject } from './portable';

export type MraidCompatibilityLevel = 'supported' | 'warning' | 'blocked';

export type MraidWidgetCompatibility = {
  type: WidgetType;
  level: MraidCompatibilityLevel;
  message: string;
};

const MRAID_WIDGET_COMPATIBILITY: Record<WidgetType, MraidWidgetCompatibilityLevel> = {
  text: 'supported',
  badge: 'supported',
  image: 'supported',
  'hero-image': 'supported',
  'video-hero': 'blocked',
  'image-carousel': 'supported',
  cta: 'supported',
  shape: 'supported',
  group: 'supported',
  countdown: 'supported',
  'add-to-calendar': 'warning',
  'shoppable-sidebar': 'warning',
  'speed-test': 'blocked',
  'scratch-reveal': 'blocked',
  form: 'supported',
  'dynamic-map': 'supported',
  'weather-conditions': 'warning',
  'range-slider': 'supported',
  'interactive-hotspot': 'warning',
  slider: 'supported',
  'qr-code': 'supported',
  'travel-deal': 'warning',
  'interactive-gallery': 'supported',
  'gen-ai-image': 'warning',
  buttons: 'supported',
};

function formatWidgetType(type: WidgetType): string {
  return type.replace(/-/g, ' ');
}

export function getMraidWidgetCompatibility(type: WidgetType): MraidWidgetCompatibility {
  const level = MRAID_WIDGET_COMPATIBILITY[type] ?? 'warning';
  switch (level) {
    case 'blocked':
      return {
        type,
        level,
        message: `MRAID v1 does not support the "${formatWidgetType(type)}" widget yet.`,
      };
    case 'warning':
      return {
        type,
        level,
        message: `The "${formatWidgetType(type)}" widget should be reviewed carefully for MRAID handoff.`,
      };
    default:
      return {
        type,
        level,
        message: `"${formatWidgetType(type)}" is supported in the current MRAID profile.`,
      };
  }
}

export function getMraidProjectCompatibility(project: PortableExportProject): MraidWidgetCompatibility[] {
  const widgetTypes = new Set<WidgetType>();
  project.scenes.forEach((scene) => {
    scene.widgets.forEach((widget) => {
      widgetTypes.add(widget.type);
    });
  });

  return [...widgetTypes]
    .map((type) => getMraidWidgetCompatibility(type))
    .filter((item) => item.level !== 'supported')
    .sort((left, right) => {
      const score = (level: MraidCompatibilityLevel) => (level === 'blocked' ? 0 : level === 'warning' ? 1 : 2);
      return score(left.level) - score(right.level) || left.type.localeCompare(right.type);
    });
}

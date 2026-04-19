import type { WidgetType } from '../domain/document/types';
import type { PortableExportProject, PortableExportWidget } from './portable';

export type MraidCompatibilityLevel = 'supported' | 'warning' | 'blocked';

export type MraidWidgetCompatibility = {
  type: WidgetType;
  level: MraidCompatibilityLevel;
  message: string;
  widgetId?: string;
};

const BASE_MRAID_WIDGET_COMPATIBILITY: Record<WidgetType, MraidCompatibilityLevel> = {
  text: 'supported',
  badge: 'supported',
  image: 'supported',
  'hero-image': 'supported',
  'video-hero': 'warning',
  'image-carousel': 'supported',
  cta: 'supported',
  shape: 'supported',
  group: 'supported',
  countdown: 'supported',
  'add-to-calendar': 'warning',
  'shoppable-sidebar': 'supported',
  'speed-test': 'blocked',
  'scratch-reveal': 'blocked',
  form: 'supported',
  'dynamic-map': 'supported',
  'weather-conditions': 'supported',
  'range-slider': 'supported',
  'interactive-hotspot': 'supported',
  slider: 'supported',
  'qr-code': 'supported',
  'travel-deal': 'warning',
  'interactive-gallery': 'supported',
  'gen-ai-image': 'warning',
  buttons: 'supported',
  'instagram-story': 'warning',
  'meta-carousel': 'warning',
  'teads-layout1': 'warning',
  'teads-layout2': 'warning',
  'tiktok-video': 'warning',
  'four-faces': 'warning',
  'vertical-accordion': 'warning',
  'particle-halo': 'warning',
  'step-indicator': 'supported',
  'timer-bar': 'warning',
  'drag-token-pool': 'warning',
  'drop-zone': 'warning',
};

function formatWidgetType(type: WidgetType): string {
  return type.replace(/-/g, ' ');
}

function baseCompatibility(type: WidgetType, widgetId?: string): MraidWidgetCompatibility {
  const level = BASE_MRAID_WIDGET_COMPATIBILITY[type] ?? 'warning';
  switch (level) {
    case 'blocked':
      return {
        type,
        widgetId,
        level,
        message: `MRAID v1 does not support the "${formatWidgetType(type)}" widget yet.`,
      };
    case 'warning':
      return {
        type,
        widgetId,
        level,
        message: `The "${formatWidgetType(type)}" widget should be reviewed carefully for MRAID handoff.`,
      };
    default:
      return {
        type,
        widgetId,
        level,
        message: `"${formatWidgetType(type)}" is supported in the current MRAID profile.`,
      };
  }
}

function evaluateVideoHero(widget: PortableExportWidget): MraidWidgetCompatibility[] {
  const props = widget.props ?? {};
  const muted = Boolean(props.muted ?? true);
  const autoplay = Boolean(props.autoplay ?? true);
  const controls = Boolean(props.controls ?? false);
  const posterSrc = String(props.posterSrc ?? '').trim();
  if (autoplay && !muted) {
    return [{
      type: widget.type,
      widgetId: widget.id,
      level: 'blocked',
      message: 'MRAID video-hero must stay muted when autoplay is enabled.',
    }];
  }
  const issues: MraidWidgetCompatibility[] = [];
  if (!posterSrc) {
    issues.push({
      type: widget.type,
      widgetId: widget.id,
      level: 'warning',
      message: 'MRAID video-hero should include a poster fallback for host containers.',
    });
  }
  if (controls) {
    issues.push({
      type: widget.type,
      widgetId: widget.id,
      level: 'warning',
      message: 'MRAID video-hero with native controls should be verified against the target host SDK.',
    });
  }
  if (!issues.length) {
    issues.push({
      type: widget.type,
      widgetId: widget.id,
      level: 'warning',
      message: 'MRAID video-hero is allowed in v1, but should be QAed for autoplay and host behavior.',
    });
  }
  return issues;
}

function evaluateWeather(widget: PortableExportWidget): MraidWidgetCompatibility[] {
  const props = widget.props ?? {};
  const liveWeather = Boolean(props.liveWeather ?? true);
  const provider = String(props.provider ?? 'open-meteo');
  if (!liveWeather || provider === 'static') return [];
  return [{
    type: widget.type,
    widgetId: widget.id,
    level: 'warning',
    message: 'Live weather in MRAID should be reviewed for network policy and cache behavior.',
  }];
}

function evaluateShoppable(widget: PortableExportWidget): MraidWidgetCompatibility[] {
  const props = widget.props ?? {};
  const autoscroll = Boolean(props.autoscroll ?? false);
  const products = String(props.products ?? '').split(';').map((item) => item.trim()).filter(Boolean);
  const issues: MraidWidgetCompatibility[] = [];
  if (autoscroll) {
    issues.push({
      type: widget.type,
      widgetId: widget.id,
      level: 'warning',
      message: 'Autoscrolling shoppable units should be reviewed carefully in MRAID containers.',
    });
  }
  if (products.length > 4) {
    issues.push({
      type: widget.type,
      widgetId: widget.id,
      level: 'warning',
      message: 'Shoppable units with more than four products should be QAed for performance in MRAID.',
    });
  }
  return issues;
}

function evaluateHotspot(widget: PortableExportWidget): MraidWidgetCompatibility[] {
  const props = widget.props ?? {};
  const effect = String(props.hotspotEffect ?? 'pulse');
  const autoCloseMs = Math.max(0, Number(props.autoCloseMs ?? 2000));
  const issues: MraidWidgetCompatibility[] = [];
  if (effect === 'ping' || effect === 'bounce') {
    issues.push({
      type: widget.type,
      widgetId: widget.id,
      level: 'warning',
      message: 'Animated hotspot effects should be QAed for MRAID host performance.',
    });
  }
  if (autoCloseMs <= 0 || autoCloseMs > 5000) {
    issues.push({
      type: widget.type,
      widgetId: widget.id,
      level: 'warning',
      message: 'Hotspot auto-close timing should stay compact for MRAID interactions.',
    });
  }
  return issues;
}

function evaluateWidget(widget: PortableExportWidget): MraidWidgetCompatibility[] {
  const base = baseCompatibility(widget.type, widget.id);
  if (base.level === 'blocked') return [base];

  const behaviorIssues =
    widget.type === 'video-hero' ? evaluateVideoHero(widget)
      : widget.type === 'weather-conditions' ? evaluateWeather(widget)
        : widget.type === 'shoppable-sidebar' ? evaluateShoppable(widget)
          : widget.type === 'interactive-hotspot' ? evaluateHotspot(widget)
            : [];

  if (behaviorIssues.length) return behaviorIssues;
  return base.level === 'warning' ? [base] : [];
}

export function getMraidWidgetCompatibility(type: WidgetType): MraidWidgetCompatibility {
  return baseCompatibility(type);
}

export function getMraidProjectCompatibility(project: PortableExportProject): MraidWidgetCompatibility[] {
  const results = project.scenes.flatMap((scene) => scene.widgets.flatMap((widget) => evaluateWidget(widget)));
  return results.sort((left, right) => {
    const score = (level: MraidCompatibilityLevel) => (level === 'blocked' ? 0 : level === 'warning' ? 1 : 2);
    return score(left.level) - score(right.level) || left.type.localeCompare(right.type) || String(left.widgetId || '').localeCompare(String(right.widgetId || ''));
  });
}

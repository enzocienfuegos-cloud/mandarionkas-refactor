import type { StudioState, WidgetNode, WidgetType } from '../domain/document/types';

export type MraidWidgetCompatibilityStatus = 'supported' | 'warning' | 'blocked';

export type MraidWidgetCompatibilityIssue = {
  widgetId: string;
  widgetName: string;
  widgetType: WidgetType;
  status: MraidWidgetCompatibilityStatus;
  reason: string;
};

const BASE_MRAID_COMPATIBILITY: Record<WidgetType, MraidWidgetCompatibilityStatus> = {
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

function countSemicolonItems(value: unknown): number {
  return String(value ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function evaluateWidgetBehavior(widget: WidgetNode): MraidWidgetCompatibilityIssue | null {
  const base = BASE_MRAID_COMPATIBILITY[widget.type];
  if (base === 'blocked') {
    return {
      widgetId: widget.id,
      widgetName: widget.name,
      widgetType: widget.type,
      status: 'blocked',
      reason: `${widget.name} uses ${widget.type}, which is not supported in MRAID v1.`,
    };
  }

  if (widget.type === 'video-hero') {
    const autoplay = Boolean(widget.props.autoplay ?? false);
    const muted = Boolean(widget.props.muted ?? true);
    const controls = Boolean(widget.props.controls ?? false);
    const posterSrc = String(widget.props.posterSrc ?? '').trim();
    if (autoplay && !muted) {
      return {
        widgetId: widget.id,
        widgetName: widget.name,
        widgetType: widget.type,
        status: 'blocked',
        reason: `${widget.name} attempts autoplay with audio, which is unsafe for MRAID hosts.`,
      };
    }
    if (controls || !posterSrc) {
      return {
        widgetId: widget.id,
        widgetName: widget.name,
        widgetType: widget.type,
        status: 'warning',
        reason: `${widget.name} should ship with a poster and avoid native controls for safer MRAID delivery.`,
      };
    }
  }

  if (widget.type === 'weather-conditions' && Boolean(widget.props.liveWeather ?? false)) {
    return {
      widgetId: widget.id,
      widgetName: widget.name,
      widgetType: widget.type,
      status: 'warning',
      reason: `${widget.name} depends on live weather data and should be reviewed for host/network constraints.`,
    };
  }

  if (widget.type === 'shoppable-sidebar' && countSemicolonItems(widget.props.products ?? `${widget.props.itemOne ?? ''};${widget.props.itemTwo ?? ''};${widget.props.itemThree ?? ''}`) > 4) {
    return {
      widgetId: widget.id,
      widgetName: widget.name,
      widgetType: widget.type,
      status: 'warning',
      reason: `${widget.name} has a dense product set and should be reviewed for compact MRAID placements.`,
    };
  }

  if (widget.type === 'interactive-hotspot') {
    return {
      widgetId: widget.id,
      widgetName: widget.name,
      widgetType: widget.type,
      status: 'warning',
      reason: `${widget.name} uses hotspot overlays and should be reviewed on touch-heavy MRAID hosts.`,
    };
  }

  if (base === 'warning') {
    return {
      widgetId: widget.id,
      widgetName: widget.name,
      widgetType: widget.type,
      status: 'warning',
      reason: `${widget.name} uses ${widget.type}, which requires manual MRAID review.`,
    };
  }

  return null;
}

export function evaluateMraidCompatibility(state: StudioState): MraidWidgetCompatibilityIssue[] {
  return Object.values(state.document.widgets)
    .map((widget) => evaluateWidgetBehavior(widget))
    .filter((item): item is MraidWidgetCompatibilityIssue => Boolean(item));
}

export function summarizeMraidCompatibility(state: StudioState): {
  blockers: MraidWidgetCompatibilityIssue[];
  warnings: MraidWidgetCompatibilityIssue[];
} {
  const issues = evaluateMraidCompatibility(state);
  return {
    blockers: issues.filter((item) => item.status === 'blocked'),
    warnings: issues.filter((item) => item.status === 'warning'),
  };
}

export type TimelineSnapTarget = {
  ms: number;
  kind: 'grid' | 'playhead' | 'start' | 'end' | 'keyframe';
  widgetId?: string;
  keyframeId?: string;
  label: string;
};

export type TimelineSnapResult = {
  valueMs: number;
  snapped: boolean;
  target?: TimelineSnapTarget;
};

type SnapTimelineWidget = {
  id: string;
  name: string;
  timeline: {
    startMs: number;
    endMs: number;
    keyframes?: Array<{ id: string; property: string; atMs: number }>;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getTimelineGridStepMs(zoom: number): number {
  if (zoom >= 2.5) return 100;
  if (zoom >= 1.5) return 250;
  if (zoom >= 0.75) return 500;
  return 1000;
}

export function buildTimelineSnapTargets(
  widgets: SnapTimelineWidget[],
  options: { excludeWidgetId?: string; playheadMs?: number } = {},
): TimelineSnapTarget[] {
  const targets: TimelineSnapTarget[] = [];

  if (options.playheadMs !== undefined) {
    targets.push({ ms: options.playheadMs, kind: 'playhead', label: 'Playhead' });
  }

  widgets.forEach((widget) => {
    if (widget.id === options.excludeWidgetId) return;
    targets.push({ ms: widget.timeline.startMs, kind: 'start', widgetId: widget.id, label: `${widget.name} start` });
    targets.push({ ms: widget.timeline.endMs, kind: 'end', widgetId: widget.id, label: `${widget.name} end` });
    (widget.timeline.keyframes ?? []).forEach((keyframe) => {
      targets.push({
        ms: keyframe.atMs,
        kind: 'keyframe',
        widgetId: widget.id,
        keyframeId: keyframe.id,
        label: `${widget.name} ${keyframe.property}`,
      });
    });
  });

  return targets;
}

export function snapTimelineMs(
  valueMs: number,
  options: {
    minMs: number;
    maxMs: number;
    stepMs?: number;
    thresholdMs?: number;
    targets?: TimelineSnapTarget[];
  },
): TimelineSnapResult {
  const clamped = clamp(valueMs, options.minMs, options.maxMs);
  const thresholdMs = Math.max(0, options.thresholdMs ?? 0);
  let bestValueMs = clamped;
  let bestTarget: TimelineSnapTarget | undefined;
  let bestDiff = Number.POSITIVE_INFINITY;

  const registerCandidate = (candidateMs: number, target: TimelineSnapTarget) => {
    const resolved = clamp(candidateMs, options.minMs, options.maxMs);
    const diff = Math.abs(resolved - clamped);
    if (diff > thresholdMs) return;
    if (diff > bestDiff) return;
    if (diff === bestDiff && bestTarget && target.kind === 'grid') return;
    bestDiff = diff;
    bestValueMs = resolved;
    bestTarget = target;
  };

  if (options.stepMs && options.stepMs > 0) {
    const gridValue = Math.round(clamped / options.stepMs) * options.stepMs;
    registerCandidate(gridValue, { ms: gridValue, kind: 'grid', label: `${options.stepMs}ms grid` });
  }

  (options.targets ?? []).forEach((target) => registerCandidate(target.ms, target));

  if (!bestTarget) {
    return { valueMs: clamped, snapped: false };
  }

  return { valueMs: bestValueMs, snapped: bestDiff > 0, target: bestTarget };
}

import { useMemo, useState, type WheelEvent } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(value.toFixed(2))));
}

export function useTimelineZoom(initial = 1) {
  const [timelineZoom, setTimelineZoom] = useState(initial);

  return useMemo(() => ({
    timelineZoom,
    zoomIn: () => setTimelineZoom((value) => clampZoom(value + 0.25)),
    zoomOut: () => setTimelineZoom((value) => clampZoom(value - 0.25)),
    onWheel: (event: WheelEvent<HTMLElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaMode === 0 ? event.deltaY * 0.008 : event.deltaY * 0.8;
      const factor = Math.exp(-delta * 0.15);
      setTimelineZoom((value) => clampZoom(value * factor));
    },
  }), [timelineZoom]);
}

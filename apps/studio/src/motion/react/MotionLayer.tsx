import { forwardRef, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import { computeWidgetMotionState, resolveWidgetMotion } from '../motion-model';
import { readConfigNumber } from '../motion-engine';
import type { MotionSelection } from '../motion-template-contract';

type MotionLayerProps = HTMLAttributes<HTMLDivElement> & {
  widget: WidgetNode;
  playheadMs: number;
  previewMode: boolean;
  isPlaying: boolean;
  selected: boolean;
  opacity: number;
  style?: CSSProperties;
};

const MOTION_TARGET_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  willChange: 'transform, opacity',
};

export const MotionLayer = forwardRef<HTMLDivElement, MotionLayerProps>(function MotionLayer(
  {
    widget,
    playheadMs,
    previewMode,
    isPlaying,
    selected,
    opacity,
    style,
    children,
    ...props
  },
  forwardedRef,
): JSX.Element {
  const motion = resolveWidgetMotion(widget);
  const liveElapsedMs = useEditorMotionElapsed({
    active: !previewMode && selected && Boolean(motion),
    restartKey: buildMotionRestartKey(widget, motion),
  });
  const motionState = useMemo(() => {
    if (!motion) return null;
    if (previewMode) {
      return computeWidgetMotionState(widget, playheadMs, opacity);
    }
    if (selected) {
      return motion.template.computeState(motion.config, liveElapsedMs, opacity);
    }
    return motion.template.computeState(motion.config, resolveRestingElapsedMs(motion), opacity);
  }, [liveElapsedMs, motion, opacity, playheadMs, previewMode, selected, widget]);
  const outerStyle = useMemo(() => {
    if (!style || !motion) return style;
    const { opacity: _opacity, ...rest } = style;
    return rest;
  }, [motion, style]);
  const innerStyle = useMemo<CSSProperties>(() => ({
    ...MOTION_TARGET_STYLE,
    opacity: motionState?.opacity,
    transform: motionState?.transform || undefined,
  }), [motionState]);

  return (
    <div
      {...props}
      ref={forwardedRef}
      style={outerStyle}
    >
      <div style={innerStyle}>
        {children}
      </div>
    </div>
  );
});

function buildMotionRestartKey(widget: WidgetNode, motion: MotionSelection | null): string {
  return JSON.stringify({
    id: widget.id,
    templateId: motion?.template.id ?? null,
    config: motion?.config ?? null,
  });
}

function resolveRestingElapsedMs(motion: MotionSelection): number {
  const delayMs = Math.max(0, readConfigNumber(motion.config, 'delayMs', 0));
  const durationMs = Math.max(120, readConfigNumber(motion.config, 'durationMs', 700));
  if (motion.template.category === 'entrance') return delayMs + durationMs;
  if (motion.template.category === 'loop') return delayMs;
  return 0;
}

function useEditorMotionElapsed({
  active,
  restartKey,
}: {
  active: boolean;
  restartKey: string;
}): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return undefined;
    }

    let frame = 0;
    let startTime: number | null = null;
    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      setElapsedMs(now - startTime);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, restartKey]);

  return elapsedMs;
}

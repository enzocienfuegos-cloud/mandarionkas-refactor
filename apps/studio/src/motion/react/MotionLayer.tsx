import { forwardRef, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import { computeWidgetMotionState, resolveWidgetMotion } from '../motion-model';
import { readConfigNumber } from '../motion-engine';

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
    isPlaying: _isPlaying,
    selected: _selected,
    opacity,
    style,
    children,
    ...props
  },
  forwardedRef,
): JSX.Element {
  const motion = resolveWidgetMotion(widget);
  const motionState = useMemo(() => {
    if (!motion) return null;
    if (previewMode) {
      return computeWidgetMotionState(widget, playheadMs, opacity);
    }
    return motion.template.computeState(motion.config, resolveRestingElapsedMs(motion), opacity);
  }, [motion, opacity, playheadMs, previewMode, widget]);
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

function resolveRestingElapsedMs(motion: NonNullable<ReturnType<typeof resolveWidgetMotion>>): number {
  const delayMs = Math.max(0, readConfigNumber(motion.config, 'delayMs', 0));
  const durationMs = Math.max(120, readConfigNumber(motion.config, 'durationMs', 700));
  if (motion.template.category === 'entrance') return delayMs + durationMs;
  if (motion.template.category === 'loop') return delayMs;
  return 0;
}

import { forwardRef, useMemo, useRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import { resolveWidgetMotion, resolveWidgetMotionCurrentTime } from '../motion-model';
import { useMotionPreview } from './use-motion-preview';

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
  const innerRef = useRef<HTMLDivElement | null>(null);
  const motion = resolveWidgetMotion(widget);
  const baseTransform = useMemo(() => '', []);
  const playbackMode: 'free' | 'scrub' | 'idle' = previewMode
    ? (isPlaying ? 'free' : 'scrub')
    : (selected ? 'free' : 'idle');
  const scrubTimeMs = playbackMode === 'scrub'
    ? resolveWidgetMotionCurrentTime(widget, playheadMs)
    : null;
  const outerStyle = useMemo(() => {
    if (!style || !motion) return style;
    const { opacity: _opacity, ...rest } = style;
    return rest;
  }, [motion, style]);

  useMotionPreview({
    ref: innerRef,
    template: motion?.template,
    config: motion?.config,
    baseOpacity: opacity,
    baseTransform,
    active: playbackMode === 'free',
    scrubTimeMs,
  });

  return (
    <div
      {...props}
      ref={forwardedRef}
      style={outerStyle}
    >
      <div ref={innerRef} style={MOTION_TARGET_STYLE}>
        {children}
      </div>
    </div>
  );
});

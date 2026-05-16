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
  const baseTransform = useMemo(() => `rotate(${widget.frame.rotation}deg)`, [widget.frame.rotation]);
  const playbackMode: 'free' | 'scrub' | 'idle' = previewMode
    ? (isPlaying ? 'free' : 'scrub')
    : (selected ? 'free' : 'idle');
  const scrubTimeMs = playbackMode === 'scrub'
    ? resolveWidgetMotionCurrentTime(widget, playheadMs)
    : null;

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
      ref={(node) => {
        innerRef.current = node;
        if (!forwardedRef) return;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else forwardedRef.current = node;
      }}
      style={style}
    >
      {children}
    </div>
  );
});

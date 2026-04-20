export type ActionTrigger =
  | 'click'
  | 'hover'
  | 'hover-enter'
  | 'hover-exit'
  | 'load'
  | 'timeline-enter'
  | 'timeline-exit'
  | 'video-play'
  | 'video-pause'
  | 'video-ended'
  | 'video-mute'
  | 'video-unmute'
  | 'vast-impression'
  | 'vast-quartile-25'
  | 'vast-quartile-50'
  | 'vast-quartile-75'
  | 'vast-complete'
  | 'vast-skip'
  | 'vast-click'
  | 'vast-error';

export type ActionEffectType =
  | 'open-url'
  | 'show-widget'
  | 'hide-widget'
  | 'toggle-widget'
  | 'set-text'
  | 'go-to-scene'
  | 'play-video'
  | 'pause-video'
  | 'seek-video'
  | 'mute-video'
  | 'unmute-video'
  | 'show-overlay'
  | 'hide-overlay'
  | 'fire-tracking-url'
  | 'emit-analytics-event';

export interface ActionNode {
  id: string;
  widgetId: string;
  trigger: ActionTrigger;
  type: ActionEffectType;
  label?: string;
  disabled?: boolean;
  targetWidgetId?: string;
  targetSceneId?: string;
  url?: string;
  target?: '_blank' | '_self';
  text?: string;
  toSeconds?: number;
  overlayId?: string;
  urls?: string[];
  eventName?: string;
  metadata?: Record<string, unknown>;
}

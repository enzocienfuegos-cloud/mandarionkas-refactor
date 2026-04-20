export type PortableStyle = Record<string, string | number>;

export interface VASTConfig {
  tagUrl: string;
  maxRedirects?: number;
  timeoutMs?: number;
  skipOffsetSecondsOverride?: number;
  companionZoneId?: string;
}

export type OverlayPosition = {
  left: number;
  top: number;
  width?: number;
  height?: number;
};

export interface CountdownContent {
  fromSeconds: number;
  completedLabel?: string;
  style?: PortableStyle;
}

export interface CTAContent {
  label: string;
  url: string;
  openInNewTab?: boolean;
  style?: PortableStyle;
}

export interface LogoContent {
  assetId: string;
  altText?: string;
  style?: PortableStyle;
}

export interface CustomHtmlContent {
  html: string;
}

export type OverlayContentMap = {
  countdown: CountdownContent;
  cta: CTAContent;
  logo: LogoContent;
  'custom-html': CustomHtmlContent;
};

export type OverlayKind = keyof OverlayContentMap;

export interface OverlayConfig<K extends OverlayKind = OverlayKind> {
  id: string;
  kind: K;
  triggerMs: number;
  durationMs?: number;
  position: OverlayPosition;
  content: OverlayContentMap[K];
}

export interface VideoControlsConfig {
  showControls: boolean;
  clickToToggle: boolean;
  showMuteButton: boolean;
  autoPlay: boolean;
  loop: boolean;
  startMuted: boolean;
}

export interface VideoWidgetTimeline {
  startMs: number;
  endMs?: number;
}

export interface VideoWidgetData {
  kind: 'video';
  assetId?: string;
  src?: string;
  mimeType?: string;
  vast?: VASTConfig;
  overlays: OverlayConfig[];
  controls: VideoControlsConfig;
  timeline: VideoWidgetTimeline;
  aspectRatio?: string;
  ariaLabel?: string;
}

export function createDefaultVideoWidget(overrides?: Partial<VideoWidgetData>): VideoWidgetData {
  return {
    kind: 'video',
    overlays: [],
    controls: {
      showControls: true,
      clickToToggle: true,
      showMuteButton: true,
      autoPlay: false,
      loop: false,
      startMuted: true,
    },
    timeline: {
      startMs: 0,
    },
    aspectRatio: '16/9',
    ...overrides,
  };
}

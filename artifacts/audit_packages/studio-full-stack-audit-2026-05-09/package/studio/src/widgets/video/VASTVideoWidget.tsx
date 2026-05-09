import { useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { VideoWidgetData } from '@smx/contracts';
import type { IVideoPlayer } from './IVideoPlayer';
import { CompanionAdSlot } from './CompanionAdSlot';
import { SkipButton } from './SkipButton';
import { useVAST } from './useVAST';
import { VideoWidgetRenderer } from './VideoWidgetRenderer';

export interface VASTVideoWidgetProps {
  widget: VideoWidgetData;
  playheadMs: number;
  onTrigger: (trigger: import('@smx/contracts').ActionTrigger, metadata?: Record<string, unknown>) => void;
  onAnalyticsEvent?: (eventName: string, metadata?: Record<string, unknown>) => void;
  onTimeUpdate?: (currentTimeMs: number) => void;
  className?: string;
  style?: CSSProperties;
  onPlayerReady?: (player: IVideoPlayer | null) => void;
  hiddenOverlayIds?: ReadonlySet<string>;
  forcedOverlayIds?: ReadonlySet<string>;
  skipButtonConfig?: Partial<import('./SkipButton').SkipButtonConfig>;
  companionSlotStyle?: CSSProperties;
  showCompanionPlaceholder?: boolean;
  showVastDebug?: boolean;
  onVastStateChange?: (state: ReturnType<typeof useVAST>) => void;
}

const vastUiPalette = {
  loadingBackground: 'rgba(0,0,0,0.4)',
  loadingText: '#ffffff',
  placeholderText: 'rgba(255,255,255,0.7)',
  placeholderBackground: 'rgba(7,11,22,0.62)',
  placeholderBorder: 'rgba(255,255,255,0.18)',
  debugBackground: 'rgba(4,8,18,0.82)',
  debugBorder: 'rgba(255,255,255,0.08)',
  debugText: '#dfe7ff',
  debugError: '#ff9c9c',
} as const;

const vastWidgetShellStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
};

const vastLoadingOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: vastUiPalette.loadingBackground,
  color: vastUiPalette.loadingText,
  fontSize: '0.875rem',
  pointerEvents: 'none',
};

const vastCompanionWrapBaseStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'auto',
};

const vastCompanionSlotFillStyle: CSSProperties = {
  width: '100%',
  height: '100%',
};

const vastCompanionPlaceholderStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  color: vastUiPalette.placeholderText,
  fontSize: 11,
  textAlign: 'center',
  background: vastUiPalette.placeholderBackground,
  border: `1px dashed ${vastUiPalette.placeholderBorder}`,
  borderRadius: 12,
  padding: 10,
  boxSizing: 'border-box',
};

const vastDebugPanelStyle: CSSProperties = {
  position: 'absolute',
  left: 10,
  bottom: 10,
  maxWidth: '70%',
  padding: '8px 10px',
  borderRadius: 10,
  background: vastUiPalette.debugBackground,
  border: `1px solid ${vastUiPalette.debugBorder}`,
  color: vastUiPalette.debugText,
  fontSize: 11,
  lineHeight: 1.35,
  backdropFilter: 'blur(6px)',
  pointerEvents: 'none',
};

const vastDebugErrorStyle: CSSProperties = {
  color: vastUiPalette.debugError,
};

function buildVastCompanionWrapStyle(companionSlotStyle?: CSSProperties): CSSProperties {
  return {
    ...vastCompanionWrapBaseStyle,
    ...companionSlotStyle,
  };
}

export function VASTVideoWidget({
  widget,
  playheadMs,
  onTrigger,
  onAnalyticsEvent,
  onTimeUpdate,
  className,
  style,
  onPlayerReady,
  hiddenOverlayIds,
  forcedOverlayIds,
  skipButtonConfig,
  companionSlotStyle,
  showCompanionPlaceholder,
  showVastDebug,
  onVastStateChange,
}: VASTVideoWidgetProps): JSX.Element {
  const vast = useVAST({
    vastConfig: widget.vast,
    onActionTrigger: (trigger, metadata) => {
      onTrigger(trigger, metadata);
      onAnalyticsEvent?.(`vast_${trigger.replace(/^vast-/, '').replace(/-/g, '_')}`, metadata);
    },
  });

  useEffect(() => {
    onVastStateChange?.(vast);
  }, [onVastStateChange, vast]);

  const effectiveWidget: VideoWidgetData = vast.selectedMediaFile
    ? {
        ...widget,
        src: vast.selectedMediaFile.src,
        mimeType: vast.selectedMediaFile.type,
        assetId: undefined,
      }
    : widget;

  const handleTrigger = useCallback((trigger: import('@smx/contracts').ActionTrigger, metadata?: Record<string, unknown>) => {
    switch (trigger) {
      case 'video-play':
        vast.onPlayerPlay();
        break;
      case 'video-pause':
        vast.onPlayerPause();
        break;
      case 'video-ended':
        vast.onPlayerEnded();
        break;
      default:
        break;
    }
    if (trigger === 'click' && widget.vast?.tagUrl) {
      vast.onAdClick();
    }
    onTrigger(trigger, metadata);
    switch (trigger) {
      case 'video-play':
        onAnalyticsEvent?.('vast_video_play', metadata);
        break;
      case 'video-pause':
        onAnalyticsEvent?.('vast_video_pause', metadata);
        break;
      case 'video-ended':
        onAnalyticsEvent?.('vast_video_ended', metadata);
        break;
      case 'click':
        onAnalyticsEvent?.('vast_video_click', metadata);
        break;
      default:
        break;
    }
  }, [onTrigger, vast, widget.vast?.tagUrl]);

  const handleTimeUpdate = useCallback((currentTimeMs: number) => {
    vast.onPlayerTimeUpdate(currentTimeMs / 1000);
    onTimeUpdate?.(currentTimeMs);
  }, [onTimeUpdate, vast]);

  return (
    <div style={vastWidgetShellStyle} className={className}>
      <VideoWidgetRenderer
        widget={effectiveWidget}
        playheadMs={playheadMs}
        onTrigger={handleTrigger}
        onAnalyticsEvent={onAnalyticsEvent}
        onTimeUpdate={handleTimeUpdate}
        style={style}
        onPlayerReady={onPlayerReady}
        hiddenOverlayIds={hiddenOverlayIds}
        forcedOverlayIds={forcedOverlayIds}
      />

      {vast.isSkippable && (vast.status === 'playing' || vast.status === 'ready') ? (
        <SkipButton countdownSeconds={vast.skipCountdownSeconds} onSkip={vast.onSkipClick} config={skipButtonConfig} />
      ) : null}

      {vast.status === 'loading' ? (
        <div style={vastLoadingOverlayStyle}>
          Loading ad…
        </div>
      ) : null}

      {widget.vast?.companionZoneId ? (
        <div style={buildVastCompanionWrapStyle(companionSlotStyle)}>
          <CompanionAdSlot
            zoneId={widget.vast.companionZoneId}
            companions={vast.companions}
            onCompanionClick={(companion) => {
              onAnalyticsEvent?.('vast_companion_click', {
                zoneId: widget.vast?.companionZoneId,
                companionWidth: companion.width,
                companionHeight: companion.height,
                clickThrough: companion.clickThrough,
              });
            }}
            style={vastCompanionSlotFillStyle}
          />
          {showCompanionPlaceholder && vast.companions.length === 0 ? (
            <div style={vastCompanionPlaceholderStyle}>
              Companion slot
            </div>
          ) : null}
        </div>
      ) : null}

      {showVastDebug ? (
        <div style={vastDebugPanelStyle}>
          <div><strong>VAST</strong> {vast.status}</div>
          <div>Tag: {widget.vast?.tagUrl ? 'connected' : 'none'}</div>
          <div>Media: {vast.selectedMediaFile?.type ?? 'n/a'}</div>
          <div>Companions: {vast.companions.length}</div>
          {vast.errorMessage ? <div style={vastDebugErrorStyle}>Error: {vast.errorMessage}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

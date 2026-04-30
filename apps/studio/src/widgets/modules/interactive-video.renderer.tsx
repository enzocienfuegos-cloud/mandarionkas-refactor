import { useCallback, useEffect, useMemo, useState } from 'react';
import { createDefaultVideoWidget, type OverlayConfig, type VideoWidgetData } from '@smx/contracts';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { VASTVideoWidget } from '../video/VASTVideoWidget';
import { VideoWidgetRenderer } from '../video/VideoWidgetRenderer';
import { moduleShellEdit } from './shared-styles';
import { registerVideoEffectContext, unregisterVideoEffectContext } from '../video/effect-registry';
import type { IVideoPlayer } from '../video/IVideoPlayer';
import { useOverlayVisibility } from '../video/useOverlayVisibility';
import { useVideoAnalyticsReporter } from '../video/useVideoAnalyticsReporter';

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readOverlayConfigs(node: WidgetNode): OverlayConfig[] {
  const configured = node.props.overlaysConfig;
  if (Array.isArray(configured) && configured.length > 0) {
    return configured as OverlayConfig[];
  }

  const overlays: OverlayConfig[] = [];

  if (readBoolean(node.props.showCountdownOverlay, false)) {
    overlays.push({
      id: 'countdown',
      kind: 'countdown',
      triggerMs: readNumber(node.props.countdownTriggerMs, 0),
      durationMs: readNumber(node.props.countdownDurationMs, 3000),
      position: {
        left: readNumber(node.props.countdownLeftPct, 42),
        top: readNumber(node.props.countdownTopPct, 12),
        width: readNumber(node.props.countdownWidthPct, 16),
      },
      content: {
        fromSeconds: readNumber(node.props.countdownFromSeconds, 3),
        completedLabel: String(node.props.countdownCompletedLabel ?? 'Go'),
        style: {
          color: String(node.props.countdownTextColor ?? '#ffffff'),
          backgroundColor: String(node.props.countdownBg ?? 'rgba(0,0,0,0.35)'),
          borderRadius: Number(node.props.countdownRadius ?? 999),
          padding: `${Number(node.props.countdownPaddingY ?? 10)}px ${Number(node.props.countdownPaddingX ?? 14)}px`,
        },
      },
    });
  }

  if (readBoolean(node.props.showCtaOverlay, false)) {
    overlays.push({
      id: 'cta',
      kind: 'cta',
      triggerMs: readNumber(node.props.ctaTriggerMs, 1500),
      durationMs: readNumber(node.props.ctaDurationMs, 4000),
      position: {
        left: readNumber(node.props.ctaLeftPct, 33),
        top: readNumber(node.props.ctaTopPct, 78),
        width: readNumber(node.props.ctaWidthPct, 34),
      },
      content: {
        label: String(node.props.ctaLabel ?? 'Learn more'),
        url: String(node.props.ctaUrl ?? ''),
        openInNewTab: readBoolean(node.props.ctaOpenInNewTab, true),
        style: {
          backgroundColor: String(node.props.ctaBg ?? '#ffffff'),
          color: String(node.props.ctaTextColor ?? '#111111'),
          borderRadius: Number(node.props.ctaRadius ?? 999),
          padding: `${Number(node.props.ctaPaddingY ?? 10)}px ${Number(node.props.ctaPaddingX ?? 18)}px`,
          fontWeight: Number(node.props.ctaFontWeight ?? 700),
        },
      },
    });
  }

  if (readBoolean(node.props.showLogoOverlay, false) && String(node.props.logoAssetId ?? '').trim()) {
    overlays.push({
      id: 'logo',
      kind: 'logo',
      triggerMs: readNumber(node.props.logoTriggerMs, 0),
      durationMs: readNumber(node.props.logoDurationMs, 0) || undefined,
      position: {
        left: readNumber(node.props.logoLeftPct, 5),
        top: readNumber(node.props.logoTopPct, 5),
        width: readNumber(node.props.logoWidthPct, 18),
      },
      content: {
        assetId: String(node.props.logoAssetId ?? '').trim(),
        altText: String(node.props.logoAltText ?? ''),
        style: {
          opacity: readNumber(node.props.logoOpacity, 1),
        },
      },
    });
  }

  if (readBoolean(node.props.showCustomHtmlOverlay, false) && String(node.props.customHtml ?? '').trim()) {
    overlays.push({
      id: 'custom-html',
      kind: 'custom-html',
      triggerMs: readNumber(node.props.customHtmlTriggerMs, 0),
      durationMs: readNumber(node.props.customHtmlDurationMs, 0) || undefined,
      position: {
        left: readNumber(node.props.customHtmlLeftPct, 10),
        top: readNumber(node.props.customHtmlTopPct, 10),
        width: readNumber(node.props.customHtmlWidthPct, 80),
        height: readNumber(node.props.customHtmlHeightPct, 40),
      },
      content: {
        html: String(node.props.customHtml ?? ''),
      },
    });
  }

  return overlays;
}

function buildVideoWidget(node: WidgetNode): VideoWidgetData {
  return createDefaultVideoWidget({
    assetId: String(node.props.assetId ?? '').trim() || undefined,
    src: String(node.props.src ?? '').trim() || undefined,
    mimeType: String(node.props.mimeType ?? '').trim() || undefined,
    vast: String(node.props.vastTagUrl ?? '').trim()
      ? {
          tagUrl: String(node.props.vastTagUrl ?? '').trim(),
          maxRedirects: readNumber(node.props.vastMaxRedirects, 5),
          timeoutMs: readNumber(node.props.vastTimeoutMs, 8000),
          skipOffsetSecondsOverride: String(node.props.vastSkipOffsetOverride ?? '').trim()
            ? readNumber(node.props.vastSkipOffsetOverride, 0)
            : undefined,
          companionZoneId: String(node.props.vastCompanionZoneId ?? '').trim() || undefined,
        }
      : undefined,
    overlays: readOverlayConfigs(node),
    controls: {
      showControls: readBoolean(node.props.showControls, false),
      clickToToggle: readBoolean(node.props.clickToToggle, true),
      showMuteButton: readBoolean(node.props.showMuteButton, true),
      autoPlay: readBoolean(node.props.autoPlay, true),
      loop: readBoolean(node.props.loop, false),
      startMuted: readBoolean(node.props.startMuted, true),
    },
    timeline: {
      startMs: node.timeline.startMs,
      endMs: node.timeline.endMs,
    },
    aspectRatio: String(node.props.aspectRatio ?? '9/16'),
    ariaLabel: String(node.props.ariaLabel ?? 'Interactive video'),
  });
}

function InteractiveVideoRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const [player, setPlayer] = useState<IVideoPlayer | null>(null);
  const [analyticsEvents, setAnalyticsEvents] = useState<Array<{
    id: string;
    name: string;
    at: number;
    metadata?: Record<string, unknown>;
  }>>([]);
  const {
    hiddenOverlayIds,
    forcedOverlayIds,
    showOverlay,
    hideOverlay,
    resetOverlayVisibility,
  } = useOverlayVisibility();
  const widget = useMemo(() => buildVideoWidget(node), [node]);
  const analyticsLimit = Math.max(1, readNumber(node.props.analyticsEventLimit, 8));
  const reportAnalyticsEvent = useVideoAnalyticsReporter(node.id, node.sceneId);

  const pushAnalyticsEvent = useCallback((eventName: string, metadata?: Record<string, unknown>) => {
    reportAnalyticsEvent(eventName, metadata);
    setAnalyticsEvents((current) => {
      const next = [
        ...current,
        {
          id: `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: eventName,
          at: Date.now(),
          metadata,
        },
      ];
      return next.slice(-analyticsLimit);
    });
  }, [analyticsLimit, reportAnalyticsEvent]);

  useEffect(() => {
    registerVideoEffectContext(node.id, {
      player,
      showOverlay,
      hideOverlay,
      emitAnalyticsEvent: pushAnalyticsEvent,
    });
    return () => {
      unregisterVideoEffectContext(node.id);
      resetOverlayVisibility();
    };
  }, [node.id, player, showOverlay, hideOverlay, resetOverlayVisibility, pushAnalyticsEvent]);

  if (!ctx.previewMode) {
    const poster = String(node.props.posterSrc ?? '').trim();
    return (
      <div
        style={{
          ...moduleShellEdit(node),
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          background: String(node.style.backgroundColor ?? '#080b16'),
        }}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82 }}
          />
        ) : null}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gap: 8,
            justifyItems: 'center',
            padding: 18,
            textAlign: 'center',
            background: 'linear-gradient(180deg,rgba(7,9,16,0.18),rgba(7,9,16,0.72))',
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.68, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Interactive Video</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{String(node.props.title ?? node.name)}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {String(node.props.src ?? '').trim() ? 'Video source ready' : 'Connect a video URL or asset'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <VASTVideoWidget
        widget={widget}
        playheadMs={ctx.playheadMs}
        onPlayerReady={setPlayer}
        hiddenOverlayIds={hiddenOverlayIds}
        forcedOverlayIds={forcedOverlayIds}
        onAnalyticsEvent={pushAnalyticsEvent}
        onTrigger={(trigger, metadata) => {
          ctx.triggerWidgetAction(trigger, metadata);
        }}
        onTimeUpdate={() => {
          // The stage timeline remains the source of truth for now.
        }}
        companionSlotStyle={readBoolean(node.props.showCompanionSlot, true)
          ? {
              left: `${readNumber(node.props.companionLeftPct, 66)}%`,
              top: `${readNumber(node.props.companionTopPct, 8)}%`,
              width: `${readNumber(node.props.companionWidthPct, 28)}%`,
              height: `${readNumber(node.props.companionHeightPct, 20)}%`,
            }
          : { display: 'none' }}
        showCompanionPlaceholder={readBoolean(node.props.showCompanionPlaceholder, true)}
        showVastDebug={readBoolean(node.props.showVastDebug, true) && Boolean(node.props.vastTagUrl)}
        style={{ height: '100%' }}
        skipButtonConfig={{
          countingLabel: String(node.props.skipCountingLabel ?? 'Skip in {seconds}'),
          skipLabel: String(node.props.skipLabel ?? 'Skip Ad ›'),
          position: (String(node.props.skipPosition ?? 'bottom-right') as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'),
        }}
      />
      {readBoolean(node.props.showAnalyticsDebug, true) ? (
        <div
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            width: 'min(320px, 72%)',
            maxHeight: '42%',
            overflow: 'auto',
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(4,8,18,0.86)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#dfe7ff',
            fontSize: 11,
            lineHeight: 1.35,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <strong>Analytics</strong>
            <span style={{ opacity: 0.7 }}>{analyticsEvents.length}/{analyticsLimit}</span>
          </div>
          {analyticsEvents.length === 0 ? (
            <div style={{ opacity: 0.72 }}>No events yet.</div>
          ) : analyticsEvents.slice().reverse().map((event) => (
            <div key={event.id} style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 700 }}>{event.name}</span>
                <span style={{ opacity: 0.65 }}>{new Date(event.at).toLocaleTimeString()}</span>
              </div>
              {event.metadata && Object.keys(event.metadata).length > 0 ? (
                <div style={{ opacity: 0.76, marginTop: 2, wordBreak: 'break-word' }}>
                  {JSON.stringify(event.metadata)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function renderInteractiveVideoStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <InteractiveVideoRenderer node={node} ctx={ctx} />;
}

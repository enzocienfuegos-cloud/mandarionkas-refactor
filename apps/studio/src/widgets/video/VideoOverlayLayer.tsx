import type { OverlayConfig, OverlayKind } from '@smx/contracts';
import { CountdownOverlay } from './overlays/CountdownOverlay';
import { CTAOverlay } from './overlays/CTAOverlay';
import { LogoOverlay } from './overlays/LogoOverlay';
import { CustomHtmlOverlay } from './overlays/CustomHtmlOverlay';

interface VideoOverlayLayerProps {
  overlays: OverlayConfig[];
  videoCurrentTimeMs: number;
  hiddenOverlayIds?: ReadonlySet<string>;
  forcedOverlayIds?: ReadonlySet<string>;
  onCTAClick?: (url: string, overlayId: string) => void;
}

function isOverlayActive(
  overlay: OverlayConfig,
  currentMs: number,
  hidden: ReadonlySet<string>,
  forced: ReadonlySet<string>,
): boolean {
  if (hidden.has(overlay.id)) return false;
  if (forced.has(overlay.id)) return true;
  if (currentMs < overlay.triggerMs) return false;
  if (overlay.durationMs !== undefined && currentMs >= overlay.triggerMs + overlay.durationMs) return false;
  return true;
}

type OverlayRendererMap = {
  [K in OverlayKind]: (
    overlay: OverlayConfig<K>,
    currentMs: number,
    handlers: Pick<VideoOverlayLayerProps, 'onCTAClick'>,
  ) => JSX.Element;
};

const OVERLAY_REGISTRY: OverlayRendererMap = {
  countdown: (overlay, currentMs) => (
    <CountdownOverlay
      key={overlay.id}
      content={overlay.content}
      position={overlay.position}
      videoCurrentTimeSeconds={currentMs / 1000}
      triggerTimeSeconds={overlay.triggerMs / 1000}
    />
  ),
  cta: (overlay, _currentMs, { onCTAClick }) => (
    <CTAOverlay
      key={overlay.id}
      content={overlay.content}
      position={overlay.position}
      onClick={(url) => onCTAClick?.(url, overlay.id)}
    />
  ),
  logo: (overlay) => <LogoOverlay key={overlay.id} content={overlay.content} position={overlay.position} />,
  'custom-html': (overlay) => <CustomHtmlOverlay key={overlay.id} content={overlay.content} position={overlay.position} />,
};

export function VideoOverlayLayer({
  overlays,
  videoCurrentTimeMs,
  hiddenOverlayIds = new Set(),
  forcedOverlayIds = new Set(),
  onCTAClick,
}: VideoOverlayLayerProps): JSX.Element {
  const activeOverlays = overlays.filter((overlay) =>
    isOverlayActive(overlay, videoCurrentTimeMs, hiddenOverlayIds, forcedOverlayIds),
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {activeOverlays.map((overlay) => {
        const renderer = OVERLAY_REGISTRY[overlay.kind] as (
          item: typeof overlay,
          currentMs: number,
          handlers: Pick<VideoOverlayLayerProps, 'onCTAClick'>,
        ) => JSX.Element;
        return renderer(overlay, videoCurrentTimeMs, { onCTAClick });
      })}
    </div>
  );
}

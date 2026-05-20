import { useEffect, useMemo, useState } from 'react';
import { resolveAssetDeliveryUrl, resolveAssetPreviewUrl, resolveAssetQualityPreference } from '../../assets/policy';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';
import { usePlatformSnapshot } from '../../platform/runtime';
import { AssetPickerButton } from '../../shared/ui/AssetPickerButton';
import type { AssetRecord } from '../../assets/types';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';

type CarouselSlideDraft = {
  src: string;
  caption: string;
  assetId?: string;
};

function parseCarouselSlideDrafts(raw: unknown): CarouselSlideDraft[] {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item, index): CarouselSlideDraft | null => {
            if (!item || typeof item !== 'object') return null;
            const src = typeof (item as { src?: unknown }).src === 'string' ? (item as { src: string }).src.trim() : '';
            const caption = typeof (item as { caption?: unknown }).caption === 'string'
              ? (item as { caption: string }).caption.trim()
              : `Slide ${index + 1}`;
            const assetId = typeof (item as { assetId?: unknown }).assetId === 'string'
              ? (item as { assetId: string }).assetId.trim()
              : undefined;
            return src ? { src, caption, assetId: assetId || undefined } : null;
          })
          .filter((item): item is CarouselSlideDraft => Boolean(item));
      }
    } catch {
      // Fall through to legacy syntax.
    }
  }
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [src, caption] = item.split('|');
      return {
        src: (src ?? '').trim(),
        caption: (caption ?? `Slide ${index + 1}`).trim(),
      };
    })
    .filter((item) => item.src);
}

function stringifyCarouselSlideDrafts(slides: CarouselSlideDraft[]): string {
  return JSON.stringify(slides);
}

const TRANSITION_OPTIONS = [
  { value: 0,   label: 'Instant' },
  { value: 150, label: 'Fast (150ms)' },
  { value: 300, label: 'Normal (300ms)' },
  { value: 500, label: 'Slow (500ms)' },
  { value: 800, label: 'Very slow (800ms)' },
];

export function ImageCarouselInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    const syncAssets = () => {
      void listAssets()
        .then((records) => {
          if (!cancelled) setAssets(records.filter((asset) => asset.kind === 'image'));
        })
        .catch(() => {
          if (!cancelled) setAssets([]);
        });
    };
    syncAssets();
    const unsubscribe = subscribeToAssetLibraryChanges(syncAssets);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  const slides = useMemo(() => parseCarouselSlideDrafts(widget.props.slides), [widget.props.slides]);

  const autoplay = Boolean(widget.props.autoplay ?? true);
  const intervalMs = Math.max(1000, Math.min(30000, Number(widget.props.intervalMs ?? 2600)));
  const intervalSec = Math.round(intervalMs / 100) / 10;
  const showPrevButton = Boolean(widget.props.showPrevButton ?? true);
  const showNextButton = Boolean(widget.props.showNextButton ?? true);
  const showPaginationDots = Boolean(widget.props.showPaginationDots ?? true);
  const paginationDotSize = Math.max(2, Math.min(10, Number(widget.props.paginationDotSize ?? 4)));
  const transitionDurationMs = Number(widget.props.transitionDurationMs ?? 300);

  function commitSlides(nextSlides: CarouselSlideDraft[]): void {
    updateWidgetProps(widget.id, { slides: stringifyCarouselSlideDrafts(nextSlides) });
  }

  function appendAssetSlide(asset: AssetRecord): void {
    const nextSlides = [
      ...slides,
      {
        src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
        caption: asset.name,
        assetId: asset.id,
      },
    ];
    commitSlides(nextSlides);
  }

  function updateSlide(index: number, patch: Partial<CarouselSlideDraft>): void {
    commitSlides(slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));
  }

  function removeSlide(index: number): void {
    commitSlides(slides.filter((_, i) => i !== index));
  }

  function moveSlide(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= slides.length) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(index, 1);
    nextSlides.splice(nextIndex, 0, moved);
    commitSlides(nextSlides);
  }

  function reorderSlides(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= slides.length || toIndex >= slides.length) return;
    const nextSlides = [...slides];
    const [moved] = nextSlides.splice(fromIndex, 1);
    nextSlides.splice(toIndex, 0, moved);
    commitSlides(nextSlides);
  }

  function resolveSlidePreview(slide: CarouselSlideDraft): string {
    if (slide.assetId) {
      const asset = assets.find((item) => item.id === slide.assetId);
      if (asset) return resolveAssetPreviewUrl(asset, targetChannel, asset.qualityPreference ?? 'auto');
    }
    return slide.src;
  }

  function describeSlideDelivery(slide: CarouselSlideDraft): string | null {
    if (!slide.assetId) return null;
    const asset = assets.find((item) => item.id === slide.assetId);
    if (!asset) return null;
    const tier = resolveAssetQualityPreference(asset, targetChannel, asset.qualityPreference ?? 'auto');
    return `${tier} · ${targetChannel}`;
  }

  return (
    <section className="section section-premium">
      <h3>Image carousel</h3>
      <div className="field-stack">

        {/* ── Slides ───────────────────────────────────── */}
        <div className="meta-line inspector-spread-row">
          <strong>{`Slides (${slides.length})`}</strong>
          <Button
            size="sm"
            variant="primary"
            onClick={() => requestOpenAssetLibrary({
              accept: 'image',
              title: 'Add slides',
              onSelect: appendAssetSlide,
            })}
          >
            + Add from library
          </Button>
        </div>

        {slides.length === 0 && (
          <div className="meta-line">No slides yet. Add images from the library above.</div>
        )}

        {slides.map((slide, index) => (
          <div
            key={`${widget.id}-slide-${index}`}
            className={dragIndex === index ? 'inspector-draggable-card is-dragging' : 'inspector-draggable-card'}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex == null) return;
              reorderSlides(dragIndex, index);
              setDragIndex(null);
            }}
          >
            <div className="inspector-card-header">
              <strong className="inspector-card-title">Slide {index + 1}</strong>
              <div className="inspector-card-actions">
                <IconButton variant="ghost" size="sm" label="Move up" icon={<StudioIcon icon={StudioIcons.chevronUp} size={14} />} onClick={() => moveSlide(index, -1)} disabled={index === 0} />
                <IconButton variant="ghost" size="sm" label="Move down" icon={<StudioIcon icon={StudioIcons.chevronDown} size={14} />} onClick={() => moveSlide(index, 1)} disabled={index === slides.length - 1} />
                <Button variant="danger" size="sm" onClick={() => removeSlide(index)}>×</Button>
              </div>
            </div>

            <div className="inspector-preview-frame">
              {resolveSlidePreview(slide) ? (
                <img src={resolveSlidePreview(slide)} alt={slide.caption} className="inspector-preview-media" />
              ) : (
                <div className="inspector-preview-empty">No preview</div>
              )}
            </div>

            <AssetPickerButton
              label="Image"
              assetId={slide.assetId}
              imageUrl={slide.src}
              accept="image"
              assets={assets}
              onChange={(asset) => updateSlide(index, {
                assetId: asset.id,
                src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
              })}
              onClear={() => updateSlide(index, { assetId: undefined, src: '' })}
            />

            {describeSlideDelivery(slide) ? (
              <small className="muted">{describeSlideDelivery(slide)}</small>
            ) : null}
          </div>
        ))}

        {/* ── Auto-slide ───────────────────────────────── */}
        <strong>Auto-slide</strong>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={autoplay}
            onChange={(event) => updateWidgetProps(widget.id, { autoplay: event.target.checked })}
          />
          Enable auto-slide
        </label>

        {autoplay && (
          <div>
            <label>Change slide every</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={intervalSec}
                style={{ flex: 1 }}
                onChange={(event) => updateWidgetProps(widget.id, { intervalMs: Math.round(Number(event.target.value) * 1000) })}
              />
              <span style={{ minWidth: 40, textAlign: 'right', fontSize: 12 }}>{intervalSec}s</span>
            </div>
          </div>
        )}

        <div>
          <label>Slide transition</label>
          <select
            value={transitionDurationMs}
            onChange={(event) => updateWidgetProps(widget.id, { transitionDurationMs: Number(event.target.value) })}
          >
            {TRANSITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* ── Navigation ───────────────────────────────── */}
        <strong>Navigation</strong>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showPrevButton}
            onChange={(event) => updateWidgetProps(widget.id, { showPrevButton: event.target.checked })}
          />
          Show Prev button
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showNextButton}
            onChange={(event) => updateWidgetProps(widget.id, { showNextButton: event.target.checked })}
          />
          Show Next button
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showPaginationDots}
            onChange={(event) => updateWidgetProps(widget.id, { showPaginationDots: event.target.checked })}
          />
          Show pagination dots
        </label>
        {showPaginationDots && (
          <div>
            <label>Dot size</label>
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={paginationDotSize}
              onChange={(event) => updateWidgetProps(widget.id, { paginationDotSize: Number(event.target.value) })}
            />
            <div className="meta-line">{paginationDotSize}px</div>
          </div>
        )}

      </div>
    </section>
  );
}

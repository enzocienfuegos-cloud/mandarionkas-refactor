import { useEffect, useMemo, useState } from 'react';
import { resolveAssetQualityPreference } from '../../assets/policy';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';
import { usePlatformSnapshot } from '../../platform/runtime';
import type { AssetRecord } from '../../assets/types';

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

export function ImageCarouselInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const uiActions = useUiActions();
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
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
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);

  function commitSlides(nextSlides: CarouselSlideDraft[]): void {
    updateWidgetProps(widget.id, { slides: stringifyCarouselSlideDrafts(nextSlides) });
  }

  function addAssetSlide(): void {
    if (!selectedAsset) return;
    const nextSlides = [
      ...slides,
      {
        src: selectedAsset.src,
        caption: selectedAsset.name,
        assetId: selectedAsset.id,
      },
    ];
    commitSlides(nextSlides);
    setSelectedAssetId('');
  }

  function updateSlide(index: number, patch: Partial<CarouselSlideDraft>): void {
    commitSlides(slides.map((slide, slideIndex) => (slideIndex === index ? { ...slide, ...patch } : slide)));
  }

  function removeSlide(index: number): void {
    commitSlides(slides.filter((_, slideIndex) => slideIndex !== index));
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
      if (asset?.thumbnailUrl) return asset.thumbnailUrl;
      if (asset?.derivatives?.thumbnail?.src) return asset.derivatives.thumbnail.src;
      if (asset?.src) return asset.src;
    }
    return slide.src;
  }

  function describeSlideDelivery(slide: CarouselSlideDraft): string | null {
    if (!slide.assetId) return null;
    const asset = assets.find((item) => item.id === slide.assetId);
    if (!asset) return null;
    const tier = resolveAssetQualityPreference(asset, targetChannel, asset.qualityPreference ?? 'auto');
    return `Uses ${tier} for ${targetChannel}`;
  }

  return (
    <section className="section section-premium">
      <h3>Image carousel</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => updateWidgetProps(widget.id, { title: event.target.value })} />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(widget.props.autoplay ?? true)}
            onChange={(event) => updateWidgetProps(widget.id, { autoplay: event.target.checked })}
          />
          Autoplay
        </label>
        <div>
          <label>Interval ms</label>
          <input
            type="number"
            step="100"
            value={String(widget.props.intervalMs ?? 2600)}
            onChange={(event) => updateWidgetProps(widget.id, { intervalMs: Number(event.target.value) })}
          />
        </div>

        <div>
          <label>Add slide from assets</label>
          <div className="asset-inline-actions">
            <select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
              <option value="">Select image asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
            <button type="button" className="left-button compact-action" onClick={addAssetSlide} disabled={!selectedAsset}>
              Add slide
            </button>
            <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
              Open library
            </button>
          </div>
        </div>

        <div className="field-stack" style={{ gap: 10 }}>
          <label>Slides</label>
          {slides.length ? slides.map((slide, index) => (
            <div
              key={`${widget.id}-slide-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex == null) return;
                reorderSlides(dragIndex, index);
                setDragIndex(null);
              }}
              style={{
                borderRadius: 12,
                border: dragIndex === index ? '1px solid rgba(245,158,11,0.55)' : '1px solid rgba(255,255,255,0.1)',
                padding: 10,
                display: 'grid',
                gap: 8,
                cursor: 'grab',
                background: dragIndex === index ? 'rgba(245,158,11,0.06)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong style={{ fontSize: 12 }}>Slide {index + 1}</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="ghost" onClick={() => moveSlide(index, -1)} disabled={index === 0}>↑</button>
                  <button type="button" className="ghost" onClick={() => moveSlide(index, 1)} disabled={index === slides.length - 1}>↓</button>
                  <button type="button" className="ghost danger" onClick={() => removeSlide(index)}>Remove</button>
                </div>
              </div>
              <small className="muted">Drag to reorder</small>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', aspectRatio: '16 / 9', minHeight: 88 }}>
                {resolveSlidePreview(slide) ? (
                  <img
                    src={resolveSlidePreview(slide)}
                    alt={slide.caption}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 12, opacity: 0.68 }}>
                    No preview
                  </div>
                )}
              </div>
              <input
                value={slide.src}
                onChange={(event) => updateSlide(index, { src: event.target.value, assetId: undefined })}
                placeholder="https://.../image.jpg"
              />
              <input
                value={slide.caption}
                onChange={(event) => updateSlide(index, { caption: event.target.value })}
                placeholder="Caption"
              />
              {describeSlideDelivery(slide) ? <small className="muted">{describeSlideDelivery(slide)}</small> : null}
              {slide.assetId ? <small className="muted">Linked asset: {slide.assetId}</small> : null}
            </div>
          )) : <small className="muted">No slides yet. Add one from the asset library.</small>}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { AssetRecord } from '../../assets/types';
import { resolveAssetDeliveryUrl } from '../../assets/policy';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import { usePlatformSnapshot } from '../../platform/runtime';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';
import { Button } from '../../shared/ui/Button';
import { getCapability } from '../registry/widget-definition';
import { getWidgetDefinition } from '../registry/widget-registry';
import { parseCarouselSlides } from './shared-styles';
import { requestOpenAssetLibrary } from '../../shared/asset-library-events';

const galleryAssetCardStyle = {
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 12,
  padding: 10,
  display: 'grid',
  gap: 8,
} as const;

const galleryAssetRowStyle = {
  justifyContent: 'space-between',
} as const;

const galleryAssetSourceStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

function buildSlidesValue(items: Array<{ src: string; caption: string }>): string {
  return items
    .filter((item) => item.src.trim().length > 0)
    .map((item) => `${item.src.trim()}|${item.caption.trim()}`)
    .join(';');
}

function parseSelectedAssetIds(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function buildSelectedAssetIds(items: string[]): string {
  return items.filter(Boolean).join(',');
}

export function GalleryAssetsInspector({ widget, title }: { widget: WidgetNode; title: string }): JSX.Element {
  const widgetActions = useWidgetActions();
  const platform = usePlatformSnapshot();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [pendingAssetIds, setPendingAssetIds] = useState<string[]>([]);
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

  const slides = useMemo(() => parseCarouselSlides(String(widget.props.slides ?? '')), [widget.props.slides]);
  const selectedAssetIds = useMemo(() => parseSelectedAssetIds(widget.props.assetIdsCsv), [widget.props.assetIdsCsv]);
  const supportsAutoplayControls = Boolean(getCapability(getWidgetDefinition(widget.type), 'isAssetGallery'));

  const addSelectedAssets = () => {
    const pickedAssets = pendingAssetIds
      .map((assetId) => assets.find((item) => item.id === assetId))
      .filter((asset): asset is AssetRecord => Boolean(asset))
      .filter((asset) => !selectedAssetIds.includes(asset.id));
    if (!pickedAssets.length) return;
    appendAssetsToGallery(pickedAssets);
    setPendingAssetIds([]);
  };

  const appendAssetsToGallery = (pickedAssets: AssetRecord[]) => {
    const freshAssets = pickedAssets.filter((asset) => !selectedAssetIds.includes(asset.id));
    if (!freshAssets.length) return;
    const nextSlides = [...slides, ...freshAssets.map((asset) => ({
      src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
      caption: '',
    }))];
    const nextIds = [...selectedAssetIds, ...freshAssets.map((asset) => asset.id)];
    widgetActions.updateWidgetProps(widget.id, {
      slides: buildSlidesValue(nextSlides),
      assetIdsCsv: buildSelectedAssetIds(nextIds),
      itemCount: nextSlides.length,
      activeIndex: 1,
    });
  };

  const removeSlide = (index: number) => {
    const nextSlides = slides.filter((_, itemIndex) => itemIndex !== index);
    const nextIds = selectedAssetIds.filter((_, itemIndex) => itemIndex !== index);
    widgetActions.updateWidgetProps(widget.id, {
      slides: buildSlidesValue(nextSlides),
      assetIdsCsv: buildSelectedAssetIds(nextIds),
      itemCount: Math.max(1, nextSlides.length),
      activeIndex: Math.min(Math.max(1, Number(widget.props.activeIndex ?? 1)), Math.max(1, nextSlides.length)),
    });
  };

  const updateCaption = (index: number, caption: string) => {
    const nextSlides = slides.map((item, itemIndex) => (itemIndex === index ? { ...item, caption } : item));
    widgetActions.updateWidgetProps(widget.id, {
      slides: buildSlidesValue(nextSlides),
      itemCount: nextSlides.length,
    });
  };

  return (
    <section className="section section-premium">
      <h3>{title}</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input
            value={String(widget.props.title ?? '')}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { title: event.target.value })}
          />
        </div>
        <div>
          <label>Project images</label>
          <div className="asset-inline-actions">
            <select
              multiple
              size={5}
              value={pendingAssetIds}
              onChange={(event) => setPendingAssetIds(Array.from(event.target.selectedOptions).map((option) => option.value))}
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
            <Button size="sm" className="left-button compact-action" onClick={addSelectedAssets} disabled={!pendingAssetIds.length}>Add images</Button>
            <Button
              size="sm"
              className="left-button compact-action"
              onClick={() => requestOpenAssetLibrary({
                accept: 'image',
                title: `Add images to ${title}`,
                onSelect: (asset: AssetRecord) => appendAssetsToGallery([asset]),
              })}
            >
              Open library
            </Button>
          </div>
        </div>
        <div>
          <label>Selected images</label>
          <div className="field-stack">
            {!slides.length ? <small className="muted">No images selected yet.</small> : null}
            {slides.map((slide, index) => (
              <div key={`${widget.id}-slide-${index}`} style={galleryAssetCardStyle}>
                <div className="meta-line" style={galleryAssetRowStyle}>
                  <strong>{`Image ${index + 1}`}</strong>
                  <button type="button" className="chip" onClick={() => removeSlide(index)}>Remove</button>
                </div>
                <input
                  value={slide.caption}
                  placeholder={`Caption ${index + 1}`}
                  onChange={(event) => updateCaption(index, event.target.value)}
                />
                <small className="muted" style={galleryAssetSourceStyle}>{slide.src}</small>
              </div>
            ))}
          </div>
        </div>
        {supportsAutoplayControls ? (
          <>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(widget.props.autoplay ?? true)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { autoplay: event.target.checked })}
              />
              Autoplay
            </label>
            <div>
              <label>Interval ms</label>
              <input
                type="number"
                step="1"
                value={String(widget.props.intervalMs ?? 2600)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { intervalMs: Number(event.target.value) })}
              />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(widget.props.showPrevButton ?? true)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showPrevButton: event.target.checked })}
              />
              Show prev button
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(widget.props.showNextButton ?? true)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showNextButton: event.target.checked })}
              />
              Show next button
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(widget.props.showPaginationDots ?? true)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showPaginationDots: event.target.checked })}
              />
              Show pagination dots
            </label>
            <div>
              <label>Dot size</label>
              <input
                type="number"
                step="1"
                min="2"
                max="5"
                value={String(widget.props.paginationDotSize ?? 3)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { paginationDotSize: Number(event.target.value) })}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label>Active image</label>
              <input
                type="number"
                min="1"
                max={String(Math.max(1, slides.length || Number(widget.props.itemCount ?? 1)))}
                value={String(widget.props.activeIndex ?? 1)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { activeIndex: Number(event.target.value), itemCount: Math.max(1, slides.length) })}
              />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(widget.props.showPrevButton ?? true)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showPrevButton: event.target.checked })}
              />
              Show prev button
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(widget.props.showNextButton ?? true)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showNextButton: event.target.checked })}
              />
              Show next button
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(widget.props.showPaginationDots ?? true)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { showPaginationDots: event.target.checked })}
              />
              Show pagination dots
            </label>
            <div>
              <label>Dot size</label>
              <input
                type="number"
                step="1"
                min="2"
                max="6"
                value={String(widget.props.paginationDotSize ?? 4)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { paginationDotSize: Number(event.target.value) })}
              />
            </div>
          </>
        )}
        <div>
          <label>Advanced slides data</label>
          <textarea
            rows={4}
            value={String(widget.props.slides ?? '')}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { slides: event.target.value, itemCount: parseCarouselSlides(event.target.value).length || Number(widget.props.itemCount ?? 1) })}
          />
        </div>
      </div>
    </section>
  );
}

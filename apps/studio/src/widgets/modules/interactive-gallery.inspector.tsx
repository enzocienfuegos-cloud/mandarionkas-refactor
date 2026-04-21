import { useEffect, useMemo, useState } from 'react';
import { resolveAssetQualityPreference } from '../../assets/policy';
import { listAssets } from '../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../repositories/asset/events';
import type { WidgetNode } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';
import { usePlatformSnapshot } from '../../platform/runtime';
import type { AssetRecord } from '../../assets/types';

type GalleryItemDraft = {
  src: string;
  title: string;
  subtitle?: string;
  assetId?: string;
};

function parseGalleryItemDrafts(raw: unknown, fallbackCount = 0): GalleryItemDraft[] {
  const value = String(raw ?? '').trim();
  if (!value) {
    return Array.from({ length: Math.max(0, fallbackCount) }, (_, index) => ({
      src: '',
      title: `Item ${index + 1}`,
    }));
  }
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item, index): GalleryItemDraft | null => {
            if (!item || typeof item !== 'object') return null;
            const src = typeof (item as { src?: unknown }).src === 'string' ? (item as { src: string }).src.trim() : '';
            const title = typeof (item as { title?: unknown }).title === 'string'
              ? (item as { title: string }).title.trim()
              : `Item ${index + 1}`;
            const subtitle = typeof (item as { subtitle?: unknown }).subtitle === 'string'
              ? (item as { subtitle: string }).subtitle.trim()
              : undefined;
            const assetId = typeof (item as { assetId?: unknown }).assetId === 'string'
              ? (item as { assetId: string }).assetId.trim()
              : undefined;
            return src ? { src, title, subtitle, assetId: assetId || undefined } : null;
          })
          .filter((item): item is GalleryItemDraft => Boolean(item));
      }
    } catch {
      // Ignore invalid JSON and fall through to placeholders.
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
        title: (caption ?? `Item ${index + 1}`).trim(),
      };
    })
    .filter((item) => item.src);
}

function stringifyGalleryItemDrafts(items: GalleryItemDraft[]): string {
  return JSON.stringify(items);
}

export function InteractiveGalleryInspector({ widget }: { widget: WidgetNode }): JSX.Element {
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

  const items = useMemo(
    () => parseGalleryItemDrafts(widget.props.items, Number(widget.props.itemCount ?? 4)),
    [widget.props.items, widget.props.itemCount],
  );
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);

  function commitItems(nextItems: GalleryItemDraft[]): void {
    updateWidgetProps(widget.id, {
      items: stringifyGalleryItemDrafts(nextItems),
      itemCount: nextItems.length,
      activeIndex: Math.min(Math.max(1, Number(widget.props.activeIndex ?? 1)), Math.max(1, nextItems.length)),
    });
  }

  function addAssetItem(): void {
    if (!selectedAsset) return;
    commitItems([
      ...items,
      {
        src: selectedAsset.src,
        title: selectedAsset.name,
        subtitle: '',
        assetId: selectedAsset.id,
      },
    ]);
    setSelectedAssetId('');
  }

  function updateItem(index: number, patch: Partial<GalleryItemDraft>): void {
    commitItems(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number): void {
    commitItems(items.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveItem(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const nextItems = [...items];
    const [moved] = nextItems.splice(index, 1);
    nextItems.splice(nextIndex, 0, moved);
    commitItems(nextItems);
  }

  function reorderItems(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return;
    const nextItems = [...items];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, moved);
    commitItems(nextItems);
  }

  function resolveItemPreview(item: GalleryItemDraft): string {
    if (item.assetId) {
      const asset = assets.find((entry) => entry.id === item.assetId);
      if (asset?.thumbnailUrl) return asset.thumbnailUrl;
      if (asset?.derivatives?.thumbnail?.src) return asset.derivatives.thumbnail.src;
      if (asset?.src) return asset.src;
    }
    return item.src;
  }

  function describeItemDelivery(item: GalleryItemDraft): string | null {
    if (!item.assetId) return null;
    const asset = assets.find((entry) => entry.id === item.assetId);
    if (!asset) return null;
    const tier = resolveAssetQualityPreference(asset, targetChannel, asset.qualityPreference ?? 'auto');
    return `Uses ${tier} for ${targetChannel}`;
  }

  return (
    <section className="section section-premium">
      <h3>Interactive gallery</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => updateWidgetProps(widget.id, { title: event.target.value })} />
        </div>
        <div>
          <label>Arrow style</label>
          <input value={String(widget.props.arrowStyle ?? 'chevron')} onChange={(event) => updateWidgetProps(widget.id, { arrowStyle: event.target.value })} />
        </div>
        <div>
          <label>Add item from assets</label>
          <div className="asset-inline-actions">
            <select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
              <option value="">Select image asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.name}</option>
              ))}
            </select>
            <button type="button" className="left-button compact-action" onClick={addAssetItem} disabled={!selectedAsset}>
              Add item
            </button>
            <button type="button" className="left-button compact-action" onClick={() => uiActions.setLeftTab('assets')}>
              Open library
            </button>
          </div>
        </div>

        <div className="field-stack" style={{ gap: 10 }}>
          <label>Items</label>
          {items.length ? items.map((item, index) => (
            <div
              key={`${widget.id}-item-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex == null) return;
                reorderItems(dragIndex, index);
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
                <strong style={{ fontSize: 12 }}>Item {index + 1}</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="ghost" onClick={() => moveItem(index, -1)} disabled={index === 0}>↑</button>
                  <button type="button" className="ghost" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>↓</button>
                  <button type="button" className="ghost danger" onClick={() => removeItem(index)}>Remove</button>
                </div>
              </div>
              <small className="muted">Drag to reorder</small>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', aspectRatio: '4 / 3', minHeight: 92 }}>
                {resolveItemPreview(item) ? (
                  <img
                    src={resolveItemPreview(item)}
                    alt={item.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 12, opacity: 0.68 }}>
                    No preview
                  </div>
                )}
              </div>
              <input
                value={item.src}
                onChange={(event) => updateItem(index, { src: event.target.value, assetId: undefined })}
                placeholder="https://.../image.jpg"
              />
              <input
                value={item.title}
                onChange={(event) => updateItem(index, { title: event.target.value })}
                placeholder="Title"
              />
              <input
                value={item.subtitle ?? ''}
                onChange={(event) => updateItem(index, { subtitle: event.target.value })}
                placeholder="Subtitle"
              />
              {describeItemDelivery(item) ? <small className="muted">{describeItemDelivery(item)}</small> : null}
              {item.assetId ? <small className="muted">Linked asset: {item.assetId}</small> : null}
            </div>
          )) : <small className="muted">No items yet. Add one from the asset library.</small>}
        </div>
      </div>
    </section>
  );
}

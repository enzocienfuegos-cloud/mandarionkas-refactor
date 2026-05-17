import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { AssetPickerButton } from '../../shared/ui/AssetPickerButton';
import {
  META_CAROUSEL_DEFAULT_CTA_LABEL,
  META_CAROUSEL_DEFAULT_PRIMARY_TEXT,
  META_CAROUSEL_DEFAULT_SPONSORED_LABEL,
} from './meta-carousel.shared';

function AssetPicker({ node, srcKey, assetIdKey, kindFilter, placeholder }: {
  node: WidgetNode; srcKey: string; assetIdKey: string;
  kindFilter: 'image' | 'video' | 'both'; placeholder?: string;
}): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  return (
    <AssetPickerButton
      label="Asset"
      assetId={String(node.props[assetIdKey] ?? '') || undefined}
      imageUrl={String(node.props[srcKey] ?? '')}
      accept={kindFilter === 'both' ? 'any' : kindFilter}
      emptyLabel={placeholder ?? 'No asset selected.'}
      onChange={(asset) => updateWidgetProps(node.id, { [assetIdKey]: asset.id, [srcKey]: asset.src })}
      onClear={() => updateWidgetProps(node.id, { [assetIdKey]: '', [srcKey]: '' })}
    />
  );
}

function SlideSection({ node, n }: { node: WidgetNode; n: 1 | 2 | 3 | 4 | 5 }) {
  const { updateWidgetProps } = useWidgetActions();
  const currentKind = String(node.props[`slide${n}Kind`] ?? 'image');
  return (
    <div className="inspector-subsection">
      <div className="inspector-subsection-title">
        Slide {n}
      </div>
      <div className="field-stack">
        <div>
          <label>Type</label>
          <select value={currentKind} onChange={(e) => updateWidgetProps(node.id, { [`slide${n}Kind`]: e.target.value, [`slide${n}Src`]: '', [`slide${n}AssetId`]: '' })}>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        <AssetPicker node={node} srcKey={`slide${n}Src`} assetIdKey={`slide${n}AssetId`} kindFilter={currentKind as 'image' | 'video'} />
        <div>
          <label>Title</label>
          <input value={String(node.props[`slide${n}Title`] ?? '')} onChange={(e) => updateWidgetProps(node.id, { [`slide${n}Title`]: e.target.value })} />
        </div>
        <div>
          <label>Description</label>
          <input value={String(node.props[`slide${n}Description`] ?? '')} onChange={(e) => updateWidgetProps(node.id, { [`slide${n}Description`]: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

export function MetaCarouselInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const slideCount = Math.min(5, Math.max(1, Number(node.props.slideCount ?? 3)));

  return (
    <>
      <section className="section section-premium">
        <h3>Brand</h3>
        <div className="field-stack">
          <div><label>Brand name</label><input value={String(node.props.brandName ?? '')} onChange={(e) => updateWidgetProps(node.id, { brandName: e.target.value })} /></div>
          <div><label>Sponsored label</label><input value={String(node.props.sponsoredLabel ?? META_CAROUSEL_DEFAULT_SPONSORED_LABEL)} onChange={(e) => updateWidgetProps(node.id, { sponsoredLabel: e.target.value })} /></div>
          <AssetPicker node={node} srcKey="brandAvatarSrc" assetIdKey="brandAvatarAssetId" kindFilter="image" placeholder="Avatar from the asset library." />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Post</h3>
        <div className="field-stack">
          <div><label>Primary text</label><textarea rows={3} value={String(node.props.primaryText ?? META_CAROUSEL_DEFAULT_PRIMARY_TEXT)} onChange={(e) => updateWidgetProps(node.id, { primaryText: e.target.value })} /></div>
          <div><label>CTA label (all slides)</label><input value={String(node.props.ctaLabel ?? META_CAROUSEL_DEFAULT_CTA_LABEL)} onChange={(e) => updateWidgetProps(node.id, { ctaLabel: e.target.value })} /></div>
          <div><label>CTA URL</label><input value={String(node.props.ctaUrl ?? '')} placeholder="https://..." onChange={(e) => updateWidgetProps(node.id, { ctaUrl: e.target.value })} /></div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Card sizing</h3>
        <div className="field-stack">
          <div>
            <label>Card width — {Number(node.props.cardWidthPct ?? 75)}% of frame</label>
            <input
              type="range" min={40} max={100} step={1}
              value={Number(node.props.cardWidthPct ?? 75)}
              onChange={(e) => updateWidgetProps(node.id, { cardWidthPct: Number(e.target.value) })}
            />
          </div>
          <div>
            <label>Image height — {Number(node.props.imageHeightPct ?? 60)}% of card zone</label>
            <input
              type="range" min={20} max={90} step={1}
              value={Number(node.props.imageHeightPct ?? 60)}
              onChange={(e) => updateWidgetProps(node.id, { imageHeightPct: Number(e.target.value) })}
            />
          </div>
          <div className="inspector-two-col-grid">
            <div>
              <label>Gap (px)</label>
              <input
                type="number" min={0} max={40} step={1}
                value={Number(node.props.cardGap ?? 10)}
                onChange={(e) => updateWidgetProps(node.id, { cardGap: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Corner radius (px)</label>
              <input
                type="number" min={0} max={24} step={1}
                value={Number(node.props.cardRadius ?? 8)}
                onChange={(e) => updateWidgetProps(node.id, { cardRadius: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Slides</h3>
        <div className="field-stack">
          <div>
            <label>Number of slides</label>
            <select value={slideCount} onChange={(e) => updateWidgetProps(node.id, { slideCount: Number(e.target.value) })}>
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {Array.from({ length: slideCount }, (_, i) => (
          <SlideSection key={i + 1} node={node} n={(i + 1) as 1 | 2 | 3 | 4 | 5} />
        ))}
      </section>
    </>
  );
}

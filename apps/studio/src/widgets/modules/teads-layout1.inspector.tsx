import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { AssetPickerButton } from '../../shared/ui/AssetPickerButton';
import { TEADS_DEFAULT_CTA_LABEL } from './teads.shared';

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

export function TeadsLayout1Inspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();
  const mediaKind = String(node.props.mediaKind ?? 'image');

  return (
    <>
      <section className="section section-premium">
        <h3>Brand</h3>
        <div className="field-stack">
          <div><label>Brand name</label><input value={String(node.props.brandName ?? '')} onChange={(e) => updateWidgetProps(node.id, { brandName: e.target.value })} /></div>
          <AssetPicker node={node} srcKey="brandLogoSrc" assetIdKey="brandLogoAssetId" kindFilter="image" placeholder="Brand logo from the asset library." />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Content</h3>
        <div className="field-stack">
          <div><label>Primary text</label><textarea rows={3} value={String(node.props.primaryText ?? '')} onChange={(e) => updateWidgetProps(node.id, { primaryText: e.target.value })} /></div>
        </div>
      </section>

      <section className="section section-premium">
        <h3>Media</h3>
        <div className="field-stack">
          <div>
            <label>Type</label>
            <select value={mediaKind} onChange={(e) => updateWidgetProps(node.id, { mediaKind: e.target.value, mediaSrc: '', mediaAssetId: '' })}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          <AssetPicker node={node} srcKey="mediaSrc" assetIdKey="mediaAssetId" kindFilter={mediaKind as 'image' | 'video'} />
        </div>
      </section>

      <section className="section section-premium">
        <h3>Footer</h3>
        <div className="field-stack">
          <div><label>Website display</label><input value={String(node.props.websiteDisplay ?? '')} placeholder="brand.com" onChange={(e) => updateWidgetProps(node.id, { websiteDisplay: e.target.value })} /></div>
          <div><label>Headline</label><input value={String(node.props.headline ?? '')} onChange={(e) => updateWidgetProps(node.id, { headline: e.target.value })} /></div>
          <div><label>Description</label><input value={String(node.props.description ?? '')} onChange={(e) => updateWidgetProps(node.id, { description: e.target.value })} /></div>
          <div><label>CTA label</label><input value={String(node.props.ctaLabel ?? TEADS_DEFAULT_CTA_LABEL)} onChange={(e) => updateWidgetProps(node.id, { ctaLabel: e.target.value })} /></div>
          <div><label>CTA URL</label><input value={String(node.props.ctaUrl ?? '')} placeholder="https://..." onChange={(e) => updateWidgetProps(node.id, { ctaUrl: e.target.value })} /></div>
        </div>
      </section>
    </>
  );
}

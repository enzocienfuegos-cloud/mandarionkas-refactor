import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { AssetPickerButton } from '../../shared/ui/AssetPickerButton';
import { Button } from '../../shared/ui/Button';

const shapeMaskFocusGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
} as const;

export function ShapeMaskInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  const hasMask = Boolean(String(node.props.maskSrc ?? '').trim());

  function clearMask() {
    updateWidgetProps(node.id, { maskSrc: '', maskAssetId: '' });
  }

  return (
    <section className="section section-premium">
      <h3>Image mask</h3>
      <div className="field-stack">
        <AssetPickerButton
          label="Mask image"
          assetId={String(node.props.maskAssetId ?? '') || undefined}
          imageUrl={String(node.props.maskSrc ?? '')}
          accept="image"
          onChange={(asset) => updateWidgetProps(node.id, { maskAssetId: asset.id, maskSrc: asset.src })}
          onClear={clearMask}
        />
        {hasMask && (
          <>
            <div>
              <label>Fit</label>
              <select
                value={String(node.props.maskFit ?? 'cover')}
                onChange={(e) => updateWidgetProps(node.id, { maskFit: e.target.value })}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </div>
            <div style={shapeMaskFocusGridStyle}>
              <div>
                <label>Focal X (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={String(node.props.maskFocalX ?? 50)}
                  onChange={(e) => updateWidgetProps(node.id, { maskFocalX: Number(e.target.value) })}
                />
              </div>
              <div>
                <label>Focal Y (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={String(node.props.maskFocalY ?? 50)}
                  onChange={(e) => updateWidgetProps(node.id, { maskFocalY: Number(e.target.value) })}
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" className="compact-action" onClick={clearMask}>Remove image mask</Button>
          </>
        )}
      </div>
    </section>
  );
}

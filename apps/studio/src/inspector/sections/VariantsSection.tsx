import { ColorControl } from '../../shared/ui/ColorControl';
import { Tile } from '../../shared/ui/Tile';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { getCapability } from '../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';

export function VariantsSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetVariant } = useWidgetActions();
  const variantNames: Array<'promo' | 'alternate'> = ['promo', 'alternate'];
  const editsText = Boolean(getCapability(getWidgetDefinition(widget.type), 'hasTextVariant'));

  return (
    <section className="section section-premium">
      <h3>Variants</h3>
      <div className="field-stack">
        <small className="muted">Each widget can override props and styles per variant without bloating a central mega-switch.</small>
        {variantNames.map((variant) => {
          const current = widget.variants?.[variant];
          return (
            <Tile key={variant}>
              <div className="meta-line"><strong>{variant}</strong><span className="pill">Overrides</span></div>
              <div className="fields-grid">
                <div>
                  <label>Text override</label>
                  <input value={String(current?.props?.text ?? current?.props?.title ?? '')} onChange={(event) => updateWidgetVariant(widget.id, variant, 'props', editsText ? { text: event.target.value } : { title: event.target.value })} />
                </div>
                <ColorControl label="Background override" value={String(current?.style?.backgroundColor ?? '')} fallback={String(widget.style.backgroundColor ?? '#1f2937')} onChange={(value) => updateWidgetVariant(widget.id, variant, 'style', { backgroundColor: value })} />
              </div>
            </Tile>
          );
        })}
      </div>
    </section>
  );
}

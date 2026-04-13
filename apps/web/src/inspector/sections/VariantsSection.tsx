import { ColorControl } from '../../shared/ui/ColorControl';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';

export function VariantsSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetVariant } = useWidgetActions();
  const variantNames: Array<'promo' | 'alternate'> = ['promo', 'alternate'];

  return (
    <section className="section section-premium">
      <h3>Variants</h3>
      <div className="field-stack">
        <small className="muted">Each widget can override props and styles per variant without bloating a central mega-switch.</small>
        {variantNames.map((variant) => {
          const current = widget.variants?.[variant];
          return (
            <div key={variant} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 10 }}>
              <div className="meta-line"><strong>{variant}</strong><span className="pill">Overrides</span></div>
              <div className="fields-grid">
                <div>
                  <label>Text override</label>
                  <input value={String(current?.props?.text ?? current?.props?.title ?? '')} onChange={(event) => updateWidgetVariant(widget.id, variant, 'props', widget.type === 'text' || widget.type === 'cta' ? { text: event.target.value } : { title: event.target.value })} />
                </div>
                <ColorControl label="Background override" value={String(current?.style?.backgroundColor ?? '')} fallback={String(widget.style.backgroundColor ?? '#1f2937')} onChange={(value) => updateWidgetVariant(widget.id, variant, 'style', { backgroundColor: value })} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

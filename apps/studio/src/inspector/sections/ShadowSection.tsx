import { ColorControl } from '../../shared/ui/ColorControl';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { readShadowFromStyle, SHADOW_LAYERS_MAX, SHADOW_LAYERS_MIN, type ShadowConfig } from '../../shared/style/shadow';

type Props = {
  node: WidgetNode;
  variant?: 'text' | 'element';
};

export function ShadowSection({ node, variant = 'element' }: Props): JSX.Element {
  const { updateWidgetStyle } = useWidgetActions();
  const shadow = readShadowFromStyle(node.style);

  const update = (patch: Partial<ShadowConfig>) => {
    updateWidgetStyle(node.id, { shadow: { ...shadow, ...patch } });
  };

  return (
    <section className="section section-premium">
      <h3>Shadow</h3>
      <div className="field-stack">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={shadow.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          Enable shadow
        </label>
        {shadow.enabled ? (
          <>
            <div className="fields-grid">
              <div>
                <label>Offset X (px)</label>
                <input
                  type="number"
                  value={shadow.offsetX}
                  onChange={(event) => update({ offsetX: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Offset Y (px)</label>
                <input
                  type="number"
                  value={shadow.offsetY}
                  onChange={(event) => update({ offsetY: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Blur (px)</label>
                <input
                  type="number"
                  min={0}
                  value={shadow.blur}
                  onChange={(event) => update({ blur: Math.max(0, Number(event.target.value)) })}
                />
              </div>
              {variant === 'element' ? (
                <div>
                  <label>Spread (px)</label>
                  <input
                    type="number"
                    value={shadow.spread}
                    onChange={(event) => update({ spread: Number(event.target.value) })}
                  />
                </div>
              ) : null}
            </div>
            <div className="fields-grid">
              <ColorControl
                label="Color"
                value={shadow.color}
                fallback="#00000040"
                onChange={(value) => update({ color: value })}
              />
              {variant === 'element' ? (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={shadow.inset}
                    onChange={(event) => update({ inset: event.target.checked })}
                  />
                  Inset
                </label>
              ) : null}
            </div>
            <div className="fields-grid">
              <div>
                <label title="Splits the shadow into multiple layers graduating from a tight core to a wide ambient shadow. More layers = softer, more natural look.">
                  Layers
                </label>
                <input
                  type="number"
                  min={SHADOW_LAYERS_MIN}
                  max={SHADOW_LAYERS_MAX}
                  value={shadow.layers}
                  onChange={(event) =>
                    update({
                      layers: Math.max(
                        SHADOW_LAYERS_MIN,
                        Math.min(SHADOW_LAYERS_MAX, Math.round(Number(event.target.value))),
                      ),
                    })
                  }
                />
              </div>
              {shadow.layers > 1 ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <small className="muted" style={{ lineHeight: 1.3 }}>
                    {shadow.layers === 2 ? 'Subtle soft shadow' :
                     shadow.layers === 3 ? 'Balanced — recommended' :
                     shadow.layers === 4 ? 'Deep, diffused shadow' :
                     'Maximum softness'}
                  </small>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

import { ColorControl } from '../../shared/ui/ColorControl';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import {
  DEFAULT_OVERLAY,
  OVERLAY_OPACITY_MAX,
  OVERLAY_OPACITY_MIN,
  readOverlayFromStyle,
  type OverlayConfig,
} from '../../shared/style/overlay';

type Props = {
  node: WidgetNode;
};

export function OverlaySection({ node }: Props): JSX.Element {
  const { updateWidgetStyle } = useWidgetActions();
  const overlay = readOverlayFromStyle(node.style);

  const update = (patch: Partial<OverlayConfig>) => {
    updateWidgetStyle(node.id, { overlay: { ...overlay, ...patch } });
  };

  return (
    <section className="section section-premium">
      <h3>Overlay</h3>
      <div className="field-stack">
        <small className="muted">
          Color layer on top of the image. Useful to improve text legibility when the image is used as a background.
        </small>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={overlay.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          Enable overlay
        </label>
        {overlay.enabled ? (
          <div className="fields-grid">
            <ColorControl
              label="Color"
              value={overlay.color}
              fallback={DEFAULT_OVERLAY.color}
              onChange={(value) => update({ color: value })}
            />
            <div>
              <label title="0 = transparent, 1 = fully opaque">
                Opacity ({Math.round(overlay.opacity * 100)}%)
              </label>
              <input
                type="range"
                min={OVERLAY_OPACITY_MIN}
                max={OVERLAY_OPACITY_MAX}
                step={0.01}
                value={overlay.opacity}
                onChange={(event) => update({ opacity: Number(event.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

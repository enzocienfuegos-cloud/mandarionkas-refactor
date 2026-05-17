import { useMemo } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { ColorControl } from '../../shared/ui/ColorControl';
import { Tile } from '../../shared/ui/Tile';

type ShadowConfig = {
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
};

const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  offsetY: 18,
  blur: 34,
  spread: 0,
  color: 'rgba(0,0,0,0.28)',
};

function parseShadow(value: unknown): ShadowConfig {
  if (typeof value !== 'string' || !value.trim() || value.trim() === 'none') {
    return DEFAULT_SHADOW_CONFIG;
  }
  const normalized = value.trim();
  const match = /^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?\s+(.+)$/.exec(normalized);
  if (!match) return DEFAULT_SHADOW_CONFIG;
  return {
    offsetY: Number(match[2]),
    blur: Number(match[3]),
    spread: Number(match[4] ?? 0),
    color: match[5],
  };
}

function stringifyShadow(config: ShadowConfig): string {
  return `0 ${config.offsetY}px ${config.blur}px ${config.spread}px ${config.color}`;
}

function mapStatePatch(
  patch: Record<string, unknown>,
  keys: {
    backgroundColor: string;
    color: string;
    borderColor: string;
    opacity: string;
    shadow: string;
  },
): Record<string, unknown> {
  const nextPatch: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'backgroundColor')) nextPatch[keys.backgroundColor] = patch.backgroundColor;
  if (Object.prototype.hasOwnProperty.call(patch, 'color')) nextPatch[keys.color] = patch.color;
  if (Object.prototype.hasOwnProperty.call(patch, 'borderColor')) nextPatch[keys.borderColor] = patch.borderColor;
  if (Object.prototype.hasOwnProperty.call(patch, 'opacity')) nextPatch[keys.opacity] = patch.opacity;
  if (Object.prototype.hasOwnProperty.call(patch, 'shadow')) nextPatch[keys.shadow] = patch.shadow;
  return nextPatch;
}

function StateVisualSection({
  title,
  backgroundColor,
  textColor,
  borderColor,
  opacity,
  shadow,
  fallbackBackgroundColor,
  fallbackTextColor,
  fallbackBorderColor,
  onChange,
}: {
  title: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  opacity: number;
  shadow: string;
  fallbackBackgroundColor: string;
  fallbackTextColor: string;
  fallbackBorderColor: string;
  onChange: (patch: Record<string, unknown>) => void;
}): JSX.Element {
  const shadowConfig = useMemo(() => parseShadow(shadow), [shadow]);

  return (
    <div className="inspector-state-card">
      <div className="inspector-state-card__header">
        <strong>{title}</strong>
        <small className="muted">Color, opacity and shadow in one place.</small>
      </div>
      <div className="fields-grid">
        <ColorControl label="Background" compact value={backgroundColor} fallback={fallbackBackgroundColor} onChange={(value) => onChange({ backgroundColor: value })} />
        <ColorControl label="Text" compact value={textColor} fallback={fallbackTextColor} onChange={(value) => onChange({ color: value })} />
        <ColorControl label="Border" compact value={borderColor} fallback={fallbackBorderColor} onChange={(value) => onChange({ borderColor: value })} />
        <div>
          <label>Opacity</label>
          <input type="number" step="0.05" min={0} max={1} value={opacity} onChange={(event) => onChange({ opacity: Number(event.target.value) })} />
        </div>
      </div>
      <div className="fields-grid inspector-state-card__shadow-grid">
        <ColorControl
          label="Shadow color"
          compact
          value={shadowConfig.color}
          fallback={DEFAULT_SHADOW_CONFIG.color}
          onChange={(value) => onChange({ shadow: stringifyShadow({ ...shadowConfig, color: value }) })}
        />
        <div>
          <label>Shadow blur</label>
          <input
            type="number"
            min={0}
            max={120}
            step="1"
            value={shadowConfig.blur}
            onChange={(event) => onChange({ shadow: stringifyShadow({ ...shadowConfig, blur: Number(event.target.value) }) })}
          />
        </div>
        <div>
          <label>Shadow Y</label>
          <input
            type="number"
            min={-120}
            max={120}
            step="1"
            value={shadowConfig.offsetY}
            onChange={(event) => onChange({ shadow: stringifyShadow({ ...shadowConfig, offsetY: Number(event.target.value) }) })}
          />
        </div>
        <div>
          <label>Spread</label>
          <input
            type="number"
            min={-120}
            max={120}
            step="1"
            value={shadowConfig.spread}
            onChange={(event) => onChange({ shadow: stringifyShadow({ ...shadowConfig, spread: Number(event.target.value) }) })}
          />
        </div>
      </div>
    </div>
  );
}

export function StatesSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetStyle } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>States</h3>
      <Tile className="states-panel-card">
        <div className="motion-panel-card__header">
          <div>
            <strong>Interactive styling</strong>
            <small className="muted">Hover and active visuals without touching the timeline.</small>
          </div>
        </div>
        <div className="field-stack">
          <StateVisualSection
            title="Hover"
            backgroundColor={String(widget.style.hoverBackgroundColor ?? '')}
            textColor={String(widget.style.hoverColor ?? '')}
            borderColor={String(widget.style.hoverBorderColor ?? '')}
            opacity={Number(widget.style.hoverOpacity ?? 1)}
            shadow={String(widget.style.hoverShadow ?? '')}
            fallbackBackgroundColor={String(widget.style.backgroundColor ?? '#1f2937')}
            fallbackTextColor={String(widget.style.color ?? '#ffffff')}
            fallbackBorderColor={String(widget.style.borderColor ?? widget.style.accentColor ?? '#f59e0b')}
            onChange={(patch) => updateWidgetStyle(widget.id, mapStatePatch(patch, {
              backgroundColor: 'hoverBackgroundColor',
              color: 'hoverColor',
              borderColor: 'hoverBorderColor',
              opacity: 'hoverOpacity',
              shadow: 'hoverShadow',
            }))}
          />
          <StateVisualSection
            title="Active"
            backgroundColor={String(widget.style.activeBackgroundColor ?? '')}
            textColor={String(widget.style.activeColor ?? '')}
            borderColor={String(widget.style.activeBorderColor ?? '')}
            opacity={Number(widget.style.activeOpacity ?? 1)}
            shadow={String(widget.style.activeShadow ?? '')}
            fallbackBackgroundColor={String(widget.style.backgroundColor ?? '#1f2937')}
            fallbackTextColor={String(widget.style.color ?? '#ffffff')}
            fallbackBorderColor={String(widget.style.borderColor ?? widget.style.accentColor ?? '#f59e0b')}
            onChange={(patch) => updateWidgetStyle(widget.id, mapStatePatch(patch, {
              backgroundColor: 'activeBackgroundColor',
              color: 'activeColor',
              borderColor: 'activeBorderColor',
              opacity: 'activeOpacity',
              shadow: 'activeShadow',
            }))}
          />
        </div>
      </Tile>
    </section>
  );
}

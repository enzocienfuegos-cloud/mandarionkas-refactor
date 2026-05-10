import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { GENERIC_EXCLUDED_PROP_KEYS, toLabel } from './widget-inspector-shared';
import {
  getModuleSkinPresetPatch,
  MODULE_SKIN_PRESET_OPTIONS,
  type ModuleSkinDensity,
  type ModuleSkinMotion,
  type ModuleSkinPresetId,
  type ModuleSkinRadius,
  type ModuleSkinSurface,
  type ModuleSkinTone,
} from '../../widgets/modules/view-model';

const MODULE_SURFACE_OPTIONS: ModuleSkinSurface[] = ['solid', 'glass', 'editorial', 'commerce', 'social'];
const MODULE_DENSITY_OPTIONS: ModuleSkinDensity[] = ['compact', 'standard', 'immersive'];
const MODULE_RADIUS_OPTIONS: ModuleSkinRadius[] = ['sm', 'md', 'lg', 'xl'];
const MODULE_MOTION_OPTIONS: ModuleSkinMotion[] = ['none', 'subtle', 'premium'];
const MODULE_TONE_OPTIONS: ModuleSkinTone[] = ['neutral', 'brand', 'dark', 'light'];

export function ModuleConfigSection({ widget }: { widget: WidgetNode }): JSX.Element | null {
  const { updateWidgetProps, updateWidgetStyle } = useWidgetActions();
  const propEntries = Object.entries(widget.props).filter(([key]) => !GENERIC_EXCLUDED_PROP_KEYS.has(key));
  const style = widget.style as Record<string, unknown>;

  function updateVisualStyle(patch: Record<string, unknown>): void {
    updateWidgetStyle(widget.id, { modulePreset: '', ...patch });
  }

  return (
    <section className="section section-premium">
      <h3>Module config</h3>
      <div className="field-stack">
        <div>
          <label>Visual recipe</label>
          <select
            value={String(style.modulePreset ?? '')}
            onChange={(event) => {
              const nextPreset = event.target.value as ModuleSkinPresetId | '';
              if (!nextPreset) {
                updateWidgetStyle(widget.id, { modulePreset: '' });
                return;
              }
              updateWidgetStyle(widget.id, getModuleSkinPresetPatch(nextPreset));
            }}
          >
            <option value="">Custom</option>
            {MODULE_SKIN_PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Surface</label>
          <select value={String(style.moduleSurface ?? 'solid')} onChange={(event) => updateVisualStyle({ moduleSurface: event.target.value })}>
            {MODULE_SURFACE_OPTIONS.map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Density</label>
          <select value={String(style.moduleDensity ?? 'standard')} onChange={(event) => updateVisualStyle({ moduleDensity: event.target.value })}>
            {MODULE_DENSITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Radius</label>
          <select value={String(style.moduleRadius ?? 'md')} onChange={(event) => updateVisualStyle({ moduleRadius: event.target.value })}>
            {MODULE_RADIUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Motion</label>
          <select value={String(style.moduleMotion ?? 'subtle')} onChange={(event) => updateVisualStyle({ moduleMotion: event.target.value })}>
            {MODULE_MOTION_OPTIONS.map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Tone</label>
          <select value={String(style.moduleTone ?? 'neutral')} onChange={(event) => updateVisualStyle({ moduleTone: event.target.value })}>
            {MODULE_TONE_OPTIONS.map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>

        {propEntries.map(([key, value]) => {
          if (typeof value === 'boolean') {
            return (
              <label className="checkbox-row" key={key}>
                <input type="checkbox" checked={value} onChange={(event) => updateWidgetProps(widget.id, { [key]: event.target.checked })} />
                {toLabel(key)}
              </label>
            );
          }

          return (
            <div key={key}>
              <label>{toLabel(key)}</label>
              <input type={typeof value === 'number' ? 'number' : 'text'} step={typeof value === 'number' ? '1' : undefined} value={String(value)} onChange={(event) => updateWidgetProps(widget.id, { [key]: typeof value === 'number' ? Number(event.target.value) : event.target.value })} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

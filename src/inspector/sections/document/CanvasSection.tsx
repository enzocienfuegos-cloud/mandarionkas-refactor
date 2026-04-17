import { ColorControl } from '../../../shared/ui/ColorControl';
import { CANVAS_PRESETS } from '../../../domain/document/canvas-presets';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { useDocumentInspectorContext } from './document-inspector-shared';

function looksLikeSolidColor(value: string): boolean {
  const trimmed = value.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) || /^rgb\(/i.test(trimmed);
}

export function CanvasSection(): JSX.Element {
  const { document } = useDocumentInspectorContext();
  const { applyCanvasPreset, updateCanvasSize, updateCanvasBackground } = useDocumentActions();
  const solidBackground = looksLikeSolidColor(document.canvas.backgroundColor);

  return (
    <section className="section section-premium">
      <h3>Canvas</h3>
      <div className="field-stack">
        <div>
          <label>Preset</label>
          <select value={document.canvas.presetId ?? 'custom'} onChange={(event) => applyCanvasPreset(event.target.value)}>
            {CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
        </div>
        <div className="fields-grid">
          <div>
            <label>Width</label>
            <input type="number" value={document.canvas.width} onChange={(event) => updateCanvasSize(Number(event.target.value), document.canvas.height)} />
          </div>
          <div>
            <label>Height</label>
            <input type="number" value={document.canvas.height} onChange={(event) => updateCanvasSize(document.canvas.width, Number(event.target.value))} />
          </div>
        </div>
        {solidBackground ? <ColorControl label="Background color" value={document.canvas.backgroundColor} fallback="#111827" onChange={updateCanvasBackground} /> : null}
        <div>
          <label>{solidBackground ? 'Background CSS' : 'Background'}</label>
          <input
            value={document.canvas.backgroundColor}
            onChange={(event) => updateCanvasBackground(event.target.value)}
            placeholder="e.g. #111827 or linear-gradient(135deg, #0f172a, #1d4ed8)"
          />
        </div>
        <small className="muted">Use a solid color or CSS gradient for lightweight backgrounds. No full background image is required for the export.</small>
        <small className="muted">Canvas presets stay as pure document configuration. The stage remains generic.</small>
      </div>
    </section>
  );
}

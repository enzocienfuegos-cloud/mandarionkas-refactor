import { ColorControl } from '../../../shared/ui/ColorControl';
import { CANVAS_PRESETS } from '../../../domain/document/canvas-presets';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { useDocumentInspectorContext } from './document-inspector-shared';

export function CanvasSection(): JSX.Element {
  const { document } = useDocumentInspectorContext();
  const { applyCanvasPreset, updateCanvasSize, updateCanvasBackground } = useDocumentActions();

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
        <ColorControl label="Background" value={document.canvas.backgroundColor} fallback="#111827" onChange={updateCanvasBackground} />
        <small className="muted">Canvas presets stay as pure document configuration. The stage remains generic.</small>
      </div>
    </section>
  );
}

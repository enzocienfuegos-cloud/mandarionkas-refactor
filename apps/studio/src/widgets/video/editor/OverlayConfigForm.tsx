import type { OverlayConfig, OverlayKind, SchemaField } from '@smx/contracts';
import { OVERLAY_SCHEMA_REGISTRY } from '@smx/contracts';

interface OverlayConfigFormProps {
  overlay: OverlayConfig;
  onChange: (updated: OverlayConfig) => void;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  if (keys.length === 1) return { ...obj, [path]: value };
  const [head, ...rest] = keys;
  const nested = (obj[head] as Record<string, unknown>) ?? {};
  return { ...obj, [head]: setPath(nested, rest.join('.'), value) };
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: SchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
}): JSX.Element {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    fontSize: '0.82rem',
    boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    color: 'inherit',
  };

  switch (field.inputType) {
    case 'toggle':
      return <input type="checkbox" checked={Boolean(value ?? field.defaultValue)} onChange={(e) => onChange(e.target.checked)} />;
    case 'number':
      return <input style={inputStyle} type="number" min={field.min} max={field.max} value={String(value ?? field.defaultValue ?? '')} onChange={(e) => onChange(Number(e.target.value))} />;
    case 'color':
      return <input type="color" value={String(value ?? field.defaultValue ?? '#000000')} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <select style={inputStyle} value={String(value ?? field.defaultValue ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      );
    case 'html-editor':
      return <textarea style={{ ...inputStyle, height: 84, resize: 'vertical', fontFamily: 'monospace' }} value={String(value ?? field.defaultValue ?? '')} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input style={inputStyle} type="text" value={String(value ?? field.defaultValue ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function OverlayConfigForm({ overlay, onChange }: OverlayConfigFormProps): JSX.Element | null {
  const schema = OVERLAY_SCHEMA_REGISTRY[overlay.kind];
  if (!schema) return null;

  const content = overlay.content as unknown as Record<string, unknown>;

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, marginTop: 8 }}>
      <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#7dd3fc', marginBottom: 8 }}>{schema.label}</div>

      <div className="fields-grid" style={{ marginBottom: 8 }}>
        <div>
          <label>Trigger (ms)</label>
          <input type="number" value={overlay.triggerMs} onChange={(e) => onChange({ ...overlay, triggerMs: Number(e.target.value) })} />
        </div>
        <div>
          <label>Duration (ms)</label>
          <input type="number" value={overlay.durationMs ?? ''} placeholder="Until end" onChange={(e) => onChange({ ...overlay, durationMs: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>

      <div className="fields-grid" style={{ marginBottom: 8 }}>
        {(['left', 'top', 'width', 'height'] as const).map((prop) => (
          <div key={prop}>
            <label>{prop} (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={overlay.position[prop] ?? ''}
              placeholder={prop === 'width' || prop === 'height' ? 'Auto' : '0'}
              onChange={(e) => onChange({
                ...overlay,
                position: { ...overlay.position, [prop]: e.target.value ? Number(e.target.value) : undefined },
              })}
            />
          </div>
        ))}
      </div>

      {schema.fields.map((field) => (
        <div key={field.key} style={{ marginBottom: 8 }}>
          <label>{field.label}{field.required ? ' *' : ''}</label>
          <FieldInput
            field={field}
            value={getPath(content, field.key)}
            onChange={(v) => onChange({ ...overlay, content: setPath(content, field.key, v) as unknown as OverlayConfig<OverlayKind>['content'] })}
          />
          {field.hint ? <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{field.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

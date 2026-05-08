import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';

type PositionInputField =
  | { label: string; kind: 'frame'; key: 'x' | 'y' | 'width' | 'height' | 'rotation' }
  | { label: string; kind: 'style'; key: 'opacity' };

export function PositionSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetFrame, updateWidgetStyle, updateWidgetProps } = useWidgetActions();
  const lockAspectRatio = Boolean(widget.props.lockAspectRatio);
  const aspectRatio = widget.frame.height > 0 ? widget.frame.width / widget.frame.height : 1;
  const fields: PositionInputField[] = [
    { label: 'X', kind: 'frame', key: 'x' },
    { label: 'Y', kind: 'frame', key: 'y' },
    { label: 'W', kind: 'frame', key: 'width' },
    { label: 'H', kind: 'frame', key: 'height' },
    { label: 'Opacity', kind: 'style', key: 'opacity' },
    { label: 'Rotation', kind: 'frame', key: 'rotation' },
  ];

  function updateFrameValue(key: 'x' | 'y' | 'width' | 'height' | 'rotation', rawValue: string): void {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;

    if (lockAspectRatio && (key === 'width' || key === 'height')) {
      if (key === 'width') {
        const width = Math.max(40, nextValue);
        updateWidgetFrame(widget.id, {
          width,
          height: Math.max(30, Math.round(width / Math.max(aspectRatio, 0.0001))),
        });
        return;
      }

      const height = Math.max(30, nextValue);
      updateWidgetFrame(widget.id, {
        height,
        width: Math.max(40, Math.round(height * Math.max(aspectRatio, 0.0001))),
      });
      return;
    }

    updateWidgetFrame(widget.id, { [key]: nextValue });
  }

  function updateOpacity(rawValue: string): void {
    const nextOpacity = Number(rawValue);
    if (!Number.isFinite(nextOpacity)) return;
    updateWidgetStyle(widget.id, { opacity: Math.max(0, Math.min(1, nextOpacity / 100)) });
  }

  return (
    <section className="section section-premium">
      <h3>Position and size</h3>
      <div className="fields-grid fields-grid--triple">
        {fields.map((field) => (
          <div key={field.key}>
            <label>{field.label}</label>
            {field.kind === 'style' ? (
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(Number(widget.style.opacity ?? 1) * 100)}
                onChange={(event) => updateOpacity(event.target.value)}
              />
            ) : (
              <input
                type="number"
                value={Math.round(widget.frame[field.key])}
                onChange={(event) => updateFrameValue(field.key, event.target.value)}
              />
            )}
          </div>
        ))}
      </div>
      <label className="checkbox-row field-toggle-row">
        <input
          type="checkbox"
          checked={lockAspectRatio}
          onChange={(event) => updateWidgetProps(widget.id, { lockAspectRatio: event.target.checked })}
        />
        Lock aspect ratio
      </label>
    </section>
  );
}

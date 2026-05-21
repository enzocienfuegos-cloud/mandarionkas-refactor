import { useStudioStore } from '../../core/store/use-studio-store';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { Button } from '../../shared/ui/Button';

export function HeroImageInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetProps, updateWidgetFrame } = useWidgetActions();
  const canvas = useStudioStore((state) => state.document.canvas);

  const cornerOptions = [
    { label: 'Rounded', value: 'rounded' },
    { label: 'Square', value: 'square' },
    { label: 'Pill', value: 'pill' },
  ];

  return (
    <section className="section section-premium">
      <h3>Hero image</h3>
      <div className="field-stack">
        <label>
          Alt text
          <input
            type="text"
            value={String(widget.props.alt ?? '')}
            onChange={(e) => updateWidgetProps(widget.id, { alt: e.target.value })}
          />
        </label>
        <div className="fields-grid">
          <label>
            Focal X
            <input
              type="number"
              value={Number(widget.props.focalX ?? 50)}
              onChange={(e) => updateWidgetProps(widget.id, { focalX: Number(e.target.value) })}
            />
          </label>
          <label>
            Focal Y
            <input
              type="number"
              value={Number(widget.props.focalY ?? 50)}
              onChange={(e) => updateWidgetProps(widget.id, { focalY: Number(e.target.value) })}
            />
          </label>
        </div>
        <label>
          Corners
          <select
            value={String(widget.props.cornerStyle ?? 'rounded')}
            onChange={(e) => updateWidgetProps(widget.id, { cornerStyle: e.target.value })}
          >
            {cornerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="compact-action"
          title="Resize and reposition this widget to cover the full canvas"
          onClick={() => updateWidgetFrame(widget.id, { x: 0, y: 0, width: canvas.width, height: canvas.height, rotation: 0 })}
        >
          Fit to canvas
        </Button>
      </div>
    </section>
  );
}

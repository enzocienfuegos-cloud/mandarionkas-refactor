import { useWidgetActions } from '../../hooks/use-studio-actions';
import { createInspectorField, createInspectorSection } from '../contract-driven';
import type { WidgetNode } from '../../domain/document/types';

export function TimingSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetTiming } = useWidgetActions();

  return createInspectorSection({
    title: 'Timing',
    children: (
      <div className="field-stack">
        <div className="fields-grid">
          {createInspectorField({
            kind: 'number',
            label: 'Start ms',
            value: widget.timeline.startMs,
            onChange: (value) => updateWidgetTiming(widget.id, { startMs: value }),
          })}
          {createInspectorField({
            kind: 'number',
            label: 'End ms',
            value: widget.timeline.endMs,
            onChange: (value) => updateWidgetTiming(widget.id, { endMs: value }),
          })}
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(widget.timeline.excluded)}
            onChange={(event) => updateWidgetTiming(widget.id, { excluded: event.target.checked })}
          />
          <span>Exclude from timeline</span>
        </label>
        <small className="muted">
          Excluded layers stay off the timeline and overview, but they still exist on stage. Use this with an initially hidden layer plus a `show-widget` action for end cards or delayed reveals.
        </small>
      </div>
    ),
  });
}

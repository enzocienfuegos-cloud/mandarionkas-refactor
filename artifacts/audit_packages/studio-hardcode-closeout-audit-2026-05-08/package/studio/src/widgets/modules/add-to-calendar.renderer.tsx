import { useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

const addToCalendarTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
};

const addToCalendarDateStyle: CSSProperties = {
  opacity: 0.82,
};

const addToCalendarButtonBaseStyle: CSSProperties = {
  marginTop: 'auto',
  padding: '10px 12px',
  borderRadius: 12,
  color: '#111827',
  fontWeight: 800,
  border: 'none',
  cursor: 'pointer',
};

function buildAddToCalendarButtonStyle(accent: string): CSSProperties {
  return {
    ...addToCalendarButtonBaseStyle,
    background: accent,
  };
}

function AddToCalendarModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const [downloaded, setDownloaded] = useState(false);

  const downloadIcs = () => {
    const eventName = String(node.props.eventName ?? 'Event');
    const date = String(node.props.date ?? '2026-05-01 18:00');
    const start = date.replace(/[-:\s]/g, '').slice(0, 15);
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${eventName}\nDTSTART:${start}\nDTEND:${start}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'event.ics';
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={moduleBody}>
        <div style={addToCalendarTitleStyle}>{String(node.props.eventName ?? 'Event')}</div>
        <div style={addToCalendarDateStyle}>{String(node.props.date ?? '')}</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            downloadIcs();
            ctx.triggerWidgetAction('click');
          }}
          style={buildAddToCalendarButtonStyle(accent)}
        >
          {downloaded ? 'ICS downloaded' : 'Add to calendar'}
        </button>
      </div>
    </div>
  );
}

export function renderAddtoCalendarStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <AddToCalendarModuleRenderer node={node} ctx={ctx} />;
}

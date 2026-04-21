import { useState } from 'react';
import { CATEGORY_ORDER, type LeftRailController } from './use-left-rail-controller';
import { clearWidgetLibraryDragPayload, createWidgetLibraryDragPayload, writeWidgetLibraryDragPayload } from '../../../canvas/stage/widget-library-drag';

export function WidgetLibrarySection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { filteredWidgets, query, setQuery, category, setCategory, counts, widgetActions } = controller;
  const [draggingWidgetType, setDraggingWidgetType] = useState<string | null>(null);

  return (
    <>
      <div className="left-rail-section-head">
        <div>
          <div className="left-title">Widget Library</div>
          <strong className="rail-heading">Canvas modules</strong>
        </div>
        <div className="pill">{filteredWidgets.length} shown</div>
      </div>

      <div className="field-stack rail-search-stack">
        <input aria-label="Search widgets" placeholder="Search modules..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="chip-row">
          <button className={`chip ${category === 'all' ? 'is-active' : ''}`} onClick={() => setCategory('all')}>All</button>
          {CATEGORY_ORDER.map((item) => (
            <button key={item} className={`chip ${category === item ? 'is-active' : ''}`} onClick={() => setCategory(item)}>
              {item} <span>{counts[item]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="widget-grid">
        {filteredWidgets.map((widget) => (
          <div
            key={widget.type}
            draggable
            role="button"
            tabIndex={0}
            className={`left-button widget-card ${draggingWidgetType === widget.type ? 'is-dragging' : ''}`}
            title="Click to add or drag to canvas"
            onClick={() => widgetActions.createWidget(widget.type)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                widgetActions.createWidget(widget.type);
              }
            }}
            onDragStart={(event) => {
              setDraggingWidgetType(widget.type);
              writeWidgetLibraryDragPayload(event.dataTransfer, createWidgetLibraryDragPayload(widget.type, widget.label));
            }}
            onDragEnd={() => {
              setDraggingWidgetType(null);
              clearWidgetLibraryDragPayload();
            }}
          >
            <div className="meta-line" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{widget.label}</div>
                <small className="muted">{widget.type}</small>
              </div>
              <span className="pill">{widget.category}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

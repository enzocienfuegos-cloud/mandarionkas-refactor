import { useState } from 'react';
import { CATEGORY_ORDER, type LeftRailController } from './use-left-rail-controller';
import { clearWidgetLibraryDragPayload, createWidgetLibraryDragPayload, writeWidgetLibraryDragPayload } from '../../../canvas/stage/widget-library-drag';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { PlaceholderThumb } from '../../../widgets/registry/widget-thumbnails';

export function WidgetLibrarySection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { filteredWidgets, query, setQuery, category, setCategory, counts, widgetActions } = controller;
  const [draggingWidgetType, setDraggingWidgetType] = useState<string | null>(null);
  const categoryOptions = [
    { id: 'all' as const, label: 'All' },
    ...CATEGORY_ORDER.map((item) => ({ id: item, label: item, count: counts[item] })),
  ];

  function renderWidgetThumbnail(widget: LeftRailController['filteredWidgets'][number]): JSX.Element {
    if (typeof widget.thumbnail === 'string') {
      return <img src={widget.thumbnail} alt="" className="widget-library-card__thumb-image" loading="lazy" />;
    }

    if (widget.thumbnail) {
      const Thumbnail = widget.thumbnail;
      return <Thumbnail />;
    }

    return <PlaceholderThumb category={widget.category} />;
  }

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
        <SegmentedControl options={categoryOptions} value={category} onChange={setCategory} ariaLabel="Widget categories" className="chip-row" />
      </div>

      <div className="widget-library-grid">
        {filteredWidgets.map((widget) => (
          <div
            key={widget.type}
            draggable
            role="button"
            tabIndex={0}
            className={`left-button widget-library-card ${draggingWidgetType === widget.type ? 'is-dragging' : ''}`}
            aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
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
            <div className="widget-library-card__thumb">
              {renderWidgetThumbnail(widget)}
            </div>

            <div className="widget-library-card__meta">
              <div className="widget-library-card__header">
                <div className="content-min-w-0">
                  <div className="widget-library-card__label">{widget.label}</div>
                  <div className="widget-library-card__type">{widget.type}</div>
                </div>
                <span className="pill">{widget.category}</span>
              </div>
              <div className="widget-library-card__hint">Click to add or drag to canvas</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

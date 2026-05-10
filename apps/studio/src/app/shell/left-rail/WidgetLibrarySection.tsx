import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_ORDER, type LeftRailController } from './use-left-rail-controller';
import { Button } from '../../../shared/ui/Button';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { WIDGET_LIBRARY_GROUP_LABELS } from '../../../widgets/registry/widget-definition';
import { type WidgetCardDensity, WidgetLibraryItemCard, WidgetLibraryModal } from './widget-library-presenters';

export function WidgetLibrarySection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { filteredWidgets, groupedWidgets, query, setQuery, category, setCategory, counts, widgetActions } = controller;
  const [draggingWidgetType, setDraggingWidgetType] = useState<string | null>(null);
  const [previewWidgetType, setPreviewWidgetType] = useState<string | null>(null);
  const [browseAllOpen, setBrowseAllOpen] = useState(false);
  const [density, setDensity] = useState<WidgetCardDensity>('compact');
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = sectionRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setDensity(entry.contentRect.width > 360 ? 'cozy' : 'compact');
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const categoryOptions = useMemo(() => [
    { id: 'all' as const, label: 'All' },
    ...CATEGORY_ORDER.map((item) => ({ id: item, label: WIDGET_LIBRARY_GROUP_LABELS[item], count: counts[item] })),
  ], [counts]);

  return (
    <>
      <div ref={sectionRef}>
        <div className="left-rail-section-head">
          <div>
            <div className="left-title">Widget Library</div>
            <strong className="rail-heading">Creative module palette</strong>
          </div>
          <div className="pill">{filteredWidgets.length} shown</div>
        </div>

        <div className="field-stack rail-search-stack">
          <input
            aria-label="Search widgets"
            placeholder="Search modules, tags, intent..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <SegmentedControl
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            ariaLabel="Widget categories"
            className="chip-row"
          />
        </div>

        {!groupedWidgets.length ? (
          <div className="story-flow-canvas-hint">
            <StudioIcon icon={StudioIcons.scanSearch} size={14} />
            No modules matched this search. Try another keyword or switch categories.
          </div>
        ) : null}

        <div className="widget-library-sections">
          {groupedWidgets.map((section) => (
            <section key={section.group} className="widget-library-section" aria-label={section.label}>
              <div className="widget-library-section__head">
                <div>
                  <div className="left-title">Category</div>
                  <strong className="widget-library-section__title">{section.label}</strong>
                </div>
                <div className="pill">{section.widgets.length}</div>
              </div>
              <div className={`widget-library-grid widget-library-grid--${density}`.trim()}>
                {section.widgets.map((widget) => (
                  <WidgetLibraryItemCard
                    key={widget.type}
                    widget={widget}
                    sectionLabel={section.label}
                    density={density}
                    draggingWidgetType={draggingWidgetType}
                    previewWidgetType={previewWidgetType}
                    setDraggingWidgetType={setDraggingWidgetType}
                    setPreviewWidgetType={setPreviewWidgetType}
                    onCreate={widgetActions.createWidget}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="widget-library-browse-all"
          iconBefore={<StudioIcon icon={StudioIcons.scanSearch} size={14} />}
          onClick={() => setBrowseAllOpen(true)}
        >
          Browse all widgets
        </Button>
      </div>

      {browseAllOpen ? <WidgetLibraryModal controller={controller} onClose={() => setBrowseAllOpen(false)} /> : null}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { useWidgetActions } from '../../../hooks/use-studio-actions';
import { CATEGORY_ORDER, type CategoryFilter, useLeftRailWidgetLibrary } from '../left-rail/use-left-rail-widget-library';
import { WIDGET_LIBRARY_GROUP_LABELS } from '../../../widgets/registry/widget-definition';
import { WidgetLibraryItemCard } from '../left-rail/widget-library-presenters';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target.isContentEditable
    || target.closest('[contenteditable="true"]') !== null;
}

export function WidgetLibraryDropdown(): JSX.Element {
  const { query, setQuery, category, setCategory, filteredWidgets, groupedWidgets, counts } = useLeftRailWidgetLibrary();
  const widgetActions = useWidgetActions();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draggingWidgetType, setDraggingWidgetType] = useState<string | null>(null);
  const [previewWidgetType, setPreviewWidgetType] = useState<string | null>(null);

  const categoryOptions = useMemo(() => [
    { id: 'all' as const, label: 'All', count: filteredWidgets.length },
    ...CATEGORY_ORDER.map((item) => ({ id: item, label: WIDGET_LIBRARY_GROUP_LABELS[item], count: counts[item] })),
  ], [counts, filteredWidgets.length]);

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.shiftKey && !event.altKey) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const popover = open ? createPortal(
    <div ref={popoverRef} className="top-widget-library-popover" role="dialog" aria-label="Widget library">
      <div className="top-widget-library-popover__head">
        <input
          type="text"
          placeholder="Search modules, tags, intent..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="top-widget-library-popover__search"
          aria-label="Search widgets"
          autoFocus
        />
        <SegmentedControl
          options={categoryOptions}
          value={category as CategoryFilter}
          onChange={setCategory}
          ariaLabel="Widget category"
          className="top-widget-library-popover__categories"
        />
      </div>
      <div className="top-widget-library-popover__body">
        {!groupedWidgets.length ? (
          <div className="top-widget-library-popover__empty">
            <StudioIcon icon={StudioIcons.scanSearch} size={16} />
            No widgets matched this search.
          </div>
        ) : groupedWidgets.map((section) => (
          <section key={section.group} className="top-widget-library-popover__section" aria-label={section.label}>
            <div className="top-widget-library-popover__section-head">
              <strong>{section.label}</strong>
              <span className="pill">{section.widgets.length}</span>
            </div>
            <div className="top-widget-library-popover__grid" role="list">
              {section.widgets.map((widget) => (
                <WidgetLibraryItemCard
                  key={widget.type}
                  widget={widget}
                  sectionLabel={section.label}
                  density="cozy"
                  draggingWidgetType={draggingWidgetType}
                  previewWidgetType={previewWidgetType}
                  setDraggingWidgetType={setDraggingWidgetType}
                  setPreviewWidgetType={setPreviewWidgetType}
                  onCreate={(widgetType) => {
                    widgetActions.createWidget(widgetType);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        className={`top-widget-library-trigger ${open ? 'is-open' : ''}`.trim()}
        iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        Widget
      </Button>
      {popover}
    </>
  );
}

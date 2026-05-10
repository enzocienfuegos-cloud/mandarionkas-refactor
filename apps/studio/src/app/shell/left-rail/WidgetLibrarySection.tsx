import { useMemo, useState } from 'react';
import { useWidgetActions } from '../../../hooks/use-studio-actions';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { WIDGET_LIBRARY_GROUP_LABELS } from '../../../widgets/registry/widget-definition';
import { IconButton } from '../../../shared/ui/IconButton';
import { CATEGORY_ORDER, useLeftRailWidgetLibrary } from './use-left-rail-widget-library';
import { CATEGORY_COLOR } from './widget-library-category-colors';
import { WidgetDetailModal } from './WidgetDetailModal';
import { WidgetLibraryItemCard } from './widget-library-presenters';

const DENSITY_ICONS = {
  compact: StudioIcons.list,
  cozy: StudioIcons.layoutGrid,
} as const;

export function WidgetLibrarySection(): JSX.Element {
  const { filteredWidgets, groupedWidgets, query, setQuery, category, setCategory, density, setDensity, counts } = useLeftRailWidgetLibrary();
  const widgetActions = useWidgetActions();
  const [draggingWidgetType, setDraggingWidgetType] = useState<string | null>(null);
  const [previewWidgetType, setPreviewWidgetType] = useState<string | null>(null);
  const [detailWidgetType, setDetailWidgetType] = useState<string | null>(null);

  const categoryOptions = useMemo(() => [
    { id: 'all' as const, label: 'All' },
    ...CATEGORY_ORDER.map((item) => ({ id: item, label: WIDGET_LIBRARY_GROUP_LABELS[item], count: counts[item] })),
  ], [counts]);

  const detailWidget = filteredWidgets.find((widget) => widget.type === detailWidgetType)
    ?? groupedWidgets.flatMap((section) => section.widgets).find((widget) => widget.type === detailWidgetType)
    ?? null;

  return (
    <div>
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
        <div className="chip-row widget-library-chip-row" role="radiogroup" aria-label="Widget categories">
          {categoryOptions.map((option) => {
            const active = option.id === category;
            const badgeClass = option.id === 'all' ? 'chip--all' : CATEGORY_COLOR[option.id].badgeClass;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`chip ${badgeClass} ${active ? 'is-active' : ''}`.trim()}
                onClick={() => setCategory(option.id)}
              >
                <span>{option.label}</span>
                {'count' in option && typeof option.count === 'number' ? <span className="chip__count">{option.count}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="widget-library-density-toggle" role="group" aria-label="Card density">
          {(['compact', 'cozy'] as const).map((option) => (
            <IconButton
              key={option}
              variant="ghost"
              size="sm"
              className="widget-library-density-toggle__button"
              label={`Use ${option} density`}
              isActive={density === option}
              icon={<StudioIcon icon={DENSITY_ICONS[option]} size={14} />}
              onClick={() => setDensity(option)}
            />
          ))}
        </div>
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
              <span className={`widget-library-card__eyebrow chip ${CATEGORY_COLOR[section.group].badgeClass} is-active`}>
                {section.label}
              </span>
              <span className="widget-library-section__count">{section.widgets.length}</span>
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
                  onOpenDetails={() => setDetailWidgetType(widget.type)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {detailWidget ? (
        <WidgetDetailModal
          widget={detailWidget}
          onClose={() => setDetailWidgetType(null)}
          onCreate={widgetActions.createWidget}
        />
      ) : null}
    </div>
  );
}

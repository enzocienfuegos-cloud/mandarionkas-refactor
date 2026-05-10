import { useEffect, useMemo, useState } from 'react';
import { readScopedStorageItem, writeScopedStorageItem } from '../../../shared/browser/storage';
import { listWidgetDefinitions } from '../../../widgets/registry/widget-registry';
import {
  WIDGET_LIBRARY_GROUP_LABELS,
  WIDGET_LIBRARY_GROUP_ORDER,
  type WidgetDefinition,
  type WidgetLibraryGroup,
} from '../../../widgets/registry/widget-definition';

export const CATEGORY_ORDER = WIDGET_LIBRARY_GROUP_ORDER;
export type CategoryFilter = 'all' | WidgetLibraryGroup;
export type WidgetCardDensity = 'compact' | 'expanded';

const DENSITY_KEY = 'smx:widget-library:density';

function readStoredDensity(): WidgetCardDensity {
  const stored = readScopedStorageItem(DENSITY_KEY, 'expanded', 'persistent');
  return stored === 'compact' ? 'compact' : 'expanded';
}

export type LeftRailWidgetLibraryState = {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  category: CategoryFilter;
  setCategory: React.Dispatch<React.SetStateAction<CategoryFilter>>;
  density: WidgetCardDensity;
  setDensity: React.Dispatch<React.SetStateAction<WidgetCardDensity>>;
  widgets: WidgetDefinition[];
  filteredWidgets: WidgetDefinition[];
  groupedWidgets: Array<{ group: WidgetLibraryGroup; label: string; widgets: WidgetDefinition[] }>;
  counts: Record<WidgetLibraryGroup, number>;
};

export function buildWidgetLibrarySearchText(widget: WidgetDefinition): string {
  return [
    widget.label,
    widget.type,
    widget.category,
    widget.description ?? '',
    widget.libraryGroup ? WIDGET_LIBRARY_GROUP_LABELS[widget.libraryGroup] : '',
    ...(widget.libraryTags ?? []),
  ].join(' ').toLowerCase();
}

export function groupWidgetsByLibraryGroup(widgets: WidgetDefinition[]): Array<{ group: WidgetLibraryGroup; label: string; widgets: WidgetDefinition[] }> {
  return WIDGET_LIBRARY_GROUP_ORDER
    .map((group) => ({
      group,
      label: WIDGET_LIBRARY_GROUP_LABELS[group],
      widgets: widgets.filter((widget) => widget.libraryGroup === group),
    }))
    .filter((section) => section.widgets.length > 0);
}

export function useLeftRailWidgetLibrary(): LeftRailWidgetLibraryState {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [density, setDensity] = useState<WidgetCardDensity>(readStoredDensity);
  const widgets = listWidgetDefinitions();

  useEffect(() => {
    writeScopedStorageItem(DENSITY_KEY, density, 'persistent');
  }, [density]);

  const filteredWidgets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return widgets.filter((widget) => {
      const matchesCategory = category === 'all' || widget.libraryGroup === category;
      const matchesQuery = !normalized || buildWidgetLibrarySearchText(widget).includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [widgets, category, query]);

  const groupedWidgets = useMemo(() => groupWidgetsByLibraryGroup(filteredWidgets), [filteredWidgets]);

  const counts = useMemo(
    () =>
      WIDGET_LIBRARY_GROUP_ORDER.reduce<Record<WidgetLibraryGroup, number>>((acc, item) => {
        acc[item] = widgets.filter((widget) => widget.libraryGroup === item).length;
        return acc;
      }, {
        essentials: 0,
        commerce: 0,
        'video-social': 0,
        interactive: 0,
        'data-utility': 0,
        'premium-fx': 0,
      }),
    [widgets],
  );

  return {
    query,
    setQuery,
    category,
    setCategory,
    density,
    setDensity,
    widgets,
    filteredWidgets,
    groupedWidgets,
    counts,
  };
}

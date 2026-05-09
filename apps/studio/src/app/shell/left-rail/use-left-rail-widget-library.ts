import { useMemo, useState } from 'react';
import { listWidgetDefinitions } from '../../../widgets/registry/widget-registry';

export const CATEGORY_ORDER = ['content', 'media', 'interactive', 'layout'] as const;
export type CategoryFilter = 'all' | (typeof CATEGORY_ORDER)[number];

export type LeftRailWidgetLibraryState = {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  category: CategoryFilter;
  setCategory: React.Dispatch<React.SetStateAction<CategoryFilter>>;
  widgets: ReturnType<typeof listWidgetDefinitions>;
  filteredWidgets: ReturnType<typeof listWidgetDefinitions>;
  counts: Record<string, number>;
};

export function useLeftRailWidgetLibrary(): LeftRailWidgetLibraryState {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const widgets = listWidgetDefinitions();

  const filteredWidgets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return widgets.filter((widget) => {
      const matchesCategory = category === 'all' || widget.category === category;
      const matchesQuery = !normalized || `${widget.label} ${widget.type} ${widget.category} ${widget.description ?? ''}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [widgets, category, query]);

  const counts = useMemo(
    () =>
      CATEGORY_ORDER.reduce<Record<string, number>>((acc, item) => {
        acc[item] = widgets.filter((widget) => widget.category === item).length;
        return acc;
      }, {}),
    [widgets],
  );

  return {
    query,
    setQuery,
    category,
    setCategory,
    widgets,
    filteredWidgets,
    counts,
  };
}

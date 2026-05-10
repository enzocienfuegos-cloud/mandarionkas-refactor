import { useCallback, useMemo, useState } from 'react';
import { loadPreference, savePreference } from '../../shared/preferences';
import type { MetricDefinition, MetricScope, ResolvedMetric } from './registry';

const PREFERENCE_PREFIX = 'dusk:metric-strip:';

interface MetricSelectionState {
  selectedIds: string[];
}

function makePreferenceKey(scopeId: string) {
  return `${PREFERENCE_PREFIX}${scopeId}`;
}

function loadSavedIds(scopeId: string, defaultIds: string[]) {
  const stored = loadPreference<MetricSelectionState>(makePreferenceKey(scopeId));
  if (stored && Array.isArray(stored.selectedIds) && stored.selectedIds.length > 0) {
    return stored.selectedIds;
  }
  return defaultIds;
}

export function useMetricSelection<TData>(scope: MetricScope<TData>, data: TData) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadSavedIds(scope.id, scope.defaultIds));

  const availableMetrics = useMemo(() => {
    return scope.metrics
      .map((definition) => {
        const resolved = definition.compute(data);
        return resolved == null ? null : { definition, resolved };
      })
      .filter((entry): entry is { definition: MetricDefinition<TData>; resolved: ResolvedMetric } => entry != null);
  }, [data, scope.metrics]);

  const cards = useMemo(() => {
    const byId = new Map(availableMetrics.map((entry) => [entry.definition.id, entry.resolved]));
    const selectedCards = selectedIds
      .map((id) => byId.get(id))
      .filter((card): card is ResolvedMetric => card != null);
    if (selectedCards.length > 0) return selectedCards;
    return scope.defaultIds
      .map((id) => byId.get(id))
      .filter((card): card is ResolvedMetric => card != null);
  }, [availableMetrics, scope.defaultIds, selectedIds]);

  const persist = useCallback((nextIds: string[]) => {
    savePreference(makePreferenceKey(scope.id), { selectedIds: nextIds });
  }, [scope.id]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id];
      if (next.length === 0) {
        return current;
      }
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    persist(scope.defaultIds);
    setSelectedIds(scope.defaultIds);
  }, [persist, scope.defaultIds]);

  const reorder = useCallback((nextOrder: string[]) => {
    persist(nextOrder);
    setSelectedIds(nextOrder);
  }, [persist]);

  const isCustomized = useMemo(() => {
    if (selectedIds.length !== scope.defaultIds.length) return true;
    return selectedIds.some((id, index) => id !== scope.defaultIds[index]);
  }, [scope.defaultIds, selectedIds]);

  return {
    cards,
    available: availableMetrics,
    selectedIds,
    toggle,
    reset,
    reorder,
    isCustomized,
  };
}

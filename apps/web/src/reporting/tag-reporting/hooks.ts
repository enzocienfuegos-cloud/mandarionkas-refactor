import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DailyStat, Tag, TagBindingOption, TagSummary } from './types';
import { formatVariantName, normalizeBindings, normalizeDailyStats, normalizeTagSummary } from './utils';

type LoadFilters = {
  creativeId: string;
  creativeSizeVariantId: string;
};

export function useTagReportingData(routeTagId: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [summary, setSummary] = useState<TagSummary | null>(null);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [bindings, setBindings] = useState<TagBindingOption[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingBindings, setLoadingBindings] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [dateRange, setDateRange] = useState(7);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedCreativeId, setSelectedCreativeId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');

  useEffect(() => {
    fetch('/v1/tags?scope=all&limit=500', { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load tags');
        return response.json();
      })
      .then((data) => {
        const list: Tag[] = data?.tags ?? data ?? [];
        setTags(list);
        if (!list.length) return;
        const initial = routeTagId
          ? list.find((tag) => tag.id === routeTagId) ?? list[0]
          : list[0];
        setSelectedTag(initial);
      })
      .catch((fetchError) => setError(fetchError.message))
      .finally(() => setLoadingTags(false));
  }, [routeTagId]);

  useEffect(() => {
    if (!routeTagId) return;
    fetch(`/v1/tags/${routeTagId}`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load selected tag');
        return response.json();
      })
      .then((data) => {
        const rawTag = data?.tag ?? data;
        if (!rawTag?.id) return;
        const normalizedTag: Tag = {
          id: String(rawTag.id),
          name: String(rawTag.name ?? ''),
          format: String(rawTag.format ?? ''),
        };
        setTags((previous) => previous.some((tag) => tag.id === normalizedTag.id) ? previous : [normalizedTag, ...previous]);
        setSelectedTag(normalizedTag);
      })
      .catch(() => {
        // Keep the list-selected fallback in place if the direct fetch fails.
      });
  }, [routeTagId]);

  useEffect(() => {
    if (!selectedTag) {
      setBindings([]);
      return;
    }

    setLoadingBindings(true);
    fetch(`/v1/tags/${selectedTag.id}/bindings`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load tag bindings');
        return response.json();
      })
      .then((data) => {
        setBindings(normalizeBindings(data?.bindings ?? data ?? []));
      })
      .catch(() => setBindings([]))
      .finally(() => setLoadingBindings(false));
  }, [selectedTag]);

  useEffect(() => {
    setSelectedCreativeId('');
    setSelectedVariantId('');
  }, [selectedTag?.id]);

  const creativeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    bindings.forEach((binding) => {
      if (!binding.creativeId || map.has(binding.creativeId)) return;
      map.set(binding.creativeId, {
        id: binding.creativeId,
        name: binding.creativeName || binding.creativeId,
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bindings]);

  const variantOptions = useMemo(() => {
    const base = selectedCreativeId
      ? bindings.filter((binding) => binding.creativeId === selectedCreativeId)
      : bindings;
    const map = new Map<string, { id: string; name: string }>();
    base.forEach((binding) => {
      if (!binding.creativeSizeVariantId || map.has(binding.creativeSizeVariantId)) return;
      map.set(binding.creativeSizeVariantId, {
        id: binding.creativeSizeVariantId,
        name: formatVariantName(binding),
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [bindings, selectedCreativeId]);

  useEffect(() => {
    if (selectedVariantId && !variantOptions.some((option) => option.id === selectedVariantId)) {
      setSelectedVariantId('');
    }
  }, [selectedVariantId, variantOptions]);

  const filteredTags = useMemo(() => {
    const needle = tagSearch.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter((tag) => tag.name.toLowerCase().includes(needle));
  }, [tags, tagSearch]);

  const loadTagData = useCallback((tag: Tag, days: number, filters: LoadFilters) => {
    setLoadingStats(true);
    setStatsError('');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const from = dateFrom.toISOString().slice(0, 10);
    const params = new URLSearchParams({ dateFrom: from });
    if (filters.creativeId) params.set('creativeId', filters.creativeId);
    if (filters.creativeSizeVariantId) params.set('creativeSizeVariantId', filters.creativeSizeVariantId);

    Promise.all([
      fetch(`/v1/tags/${tag.id}/summary?${params.toString()}`, { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Failed to load summary');
        return response.json();
      }),
      fetch(`/v1/tags/${tag.id}/stats?${params.toString()}`, { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Failed to load stats');
        return response.json();
      }),
    ])
      .then(([summaryData, statData]) => {
        setSummary(normalizeTagSummary(summaryData?.summary ?? summaryData ?? null));
        setStats(normalizeDailyStats(statData?.stats ?? statData ?? []));
      })
      .catch(() => setStatsError('Failed to load tag statistics.'))
      .finally(() => setLoadingStats(false));
  }, []);

  useEffect(() => {
    if (!selectedTag) return;
    loadTagData(selectedTag, dateRange, {
      creativeId: selectedCreativeId,
      creativeSizeVariantId: selectedVariantId,
    });
  }, [selectedTag, dateRange, selectedCreativeId, selectedVariantId, loadTagData]);

  return {
    tags,
    selectedTag,
    setSelectedTag,
    summary,
    stats,
    bindings,
    loadingTags,
    loadingBindings,
    loadingStats,
    error,
    statsError,
    setStatsError,
    dateRange,
    setDateRange,
    tagSearch,
    setTagSearch,
    selectedCreativeId,
    setSelectedCreativeId,
    selectedVariantId,
    setSelectedVariantId,
    creativeOptions,
    variantOptions,
    filteredTags,
    loadTagData,
  };
}

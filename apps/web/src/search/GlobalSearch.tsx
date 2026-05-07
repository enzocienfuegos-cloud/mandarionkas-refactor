import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, EmptyState, Input, Modal, Panel } from '../system';
import { Building2, Command, Film, Megaphone, Search, Tag, X } from '../system/icons';

type SearchType = 'all' | 'tags' | 'campaigns' | 'advertisers' | 'creatives';

interface SearchResult {
  id: string;
  type: 'tag' | 'campaign' | 'advertiser' | 'creative';
  name: string;
  subtitle?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

const TYPE_PATHS: Record<SearchResult['type'], (id: string) => string> = {
  tag:        id => `/tags/${id}`,
  campaign:   id => `/campaigns/${id}`,
  advertiser: () => '/campaigns',
  creative:   () => '/creatives',
};

const TYPE_ICONS: Record<SearchResult['type'], React.ReactNode> = {
  tag: <Tag className="h-4 w-4" />,
  campaign: <Megaphone className="h-4 w-4" />,
  advertiser: <Building2 className="h-4 w-4" />,
  creative: <Film className="h-4 w-4" />,
};

const FILTERS: Array<{ value: SearchType; label: string }> = [
  { value: 'all',         label: 'All' },
  { value: 'tags',        label: 'Tags' },
  { value: 'campaigns',   label: 'Campaigns' },
  { value: 'advertisers', label: 'Advertisers' },
  { value: 'creatives',   label: 'Creatives' },
];

function groupByType(results: SearchResult[]): Record<string, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!groups[r.type]) groups[r.type] = [];
    groups[r.type].push(r);
  }
  return groups;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SearchType>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openModal = () => {
    setOpen(true);
    setQuery('');
    setResults([]);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeModal = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openModal();
      }
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const doSearch = useCallback((q: string, type: SearchType) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ q });
    if (type !== 'all') params.set('type', type);

    fetch(`/v1/search?${params}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Search failed'); return r.json() as Promise<SearchResponse>; })
      .then(d => setResults(d?.results ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, typeFilter), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, typeFilter, doSearch]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'creative') {
      navigate(`/creatives?search=${encodeURIComponent(result.name)}`);
      closeModal();
      return;
    }
    if (result.type === 'advertiser') {
      navigate(`/campaigns?search=${encodeURIComponent(result.name)}`);
      closeModal();
      return;
    }
    navigate(TYPE_PATHS[result.type](result.id));
    closeModal();
  };

  const grouped = groupByType(results);

  return (
    <>
      {/* Trigger button */}
      <Button
        onClick={openModal}
        variant="secondary"
        size="sm"
        className="hidden md:inline-flex"
        leadingIcon={<Search />}
        trailingIcon={<Command />}
      >
        Search…
      </Button>

      {/* Modal */}
      <Modal
        open={open}
        onClose={closeModal}
        title="Global Search"
        description="Search tags, campaigns, advertisers and creatives from one keyboard-first surface."
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-[color:var(--dusk-text-muted)]">
              {results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''} · Press Enter to open first result` : 'Esc closes search'}
            </span>
            <Button variant="ghost" size="sm" leadingIcon={<X />} onClick={closeModal}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && results.length > 0) {
                    e.preventDefault();
                    handleSelect(results[0]);
                  }
                }}
                placeholder="Search tags, campaigns, creatives..."
                leadingIcon={<Search />}
              />
            </div>
            <Badge tone="neutral" size="sm">⌘K</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <Button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                variant={typeFilter === f.value ? 'primary' : 'secondary'}
                size="sm"
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto rounded-2xl border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-1)]">
            {error && (
              <Panel className="m-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
                {error}
              </Panel>
            )}

            {!loading && !error && query && results.length === 0 && (
              <EmptyState
                title={`No results for "${query}"`}
                description="Try a broader term or switch the entity filter."
              />
            )}

            {!query && (
              <EmptyState
                title="Start typing to search"
                description="Use one search surface for tags, campaigns, advertisers and creatives."
              />
            )}

            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="border-b border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-4 py-2 text-xs font-semibold uppercase tracking-kicker text-[color:var(--dusk-text-muted)]">
                  {type}s
                </div>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center gap-3 border-b border-[color:var(--dusk-border-subtle)] px-4 py-3 text-left transition-colors hover:bg-[color:var(--dusk-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--dusk-status-info-border)]"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]">
                      {TYPE_ICONS[item.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[color:var(--dusk-text-primary)]">{item.name}</p>
                      {item.subtitle && (
                        <p className="truncate text-xs text-[color:var(--dusk-text-muted)]">{item.subtitle}</p>
                      )}
                    </div>
                    <Badge tone="neutral" size="sm">{item.type}</Badge>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}

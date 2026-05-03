import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

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

const TYPE_ICONS: Record<SearchResult['type'], string> = {
  tag:        '🏷️',
  campaign:   '📋',
  advertiser: '🏢',
  creative:   '🎨',
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
      <button
        onClick={openModal}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <span>🔍</span>
        <span>Search...</span>
        <kbd className="ml-2 text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200">
              <span className="text-slate-400">🔍</span>
              <input
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
                className="flex-1 text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
              />
              {loading && (
                <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              <kbd
                onClick={closeModal}
                className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer hover:bg-slate-200"
              >
                Esc
              </kbd>
            </div>

            {/* Type filter pills */}
            <div className="flex gap-1 px-4 py-2 border-b border-slate-100 overflow-x-auto">
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    typeFilter === f.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {error && (
                <div className="px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              {!loading && !error && query && results.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  No results found for "{query}"
                </div>
              )}

              {!query && (
                <div className="px-4 py-8 text-center text-sm text-slate-400">
                  Start typing to search across your workspace
                </div>
              )}

              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100">
                    {type}s
                  </div>
                  {items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-slate-50"
                    >
                      <span className="text-xl flex-shrink-0">{TYPE_ICONS[item.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                        {item.subtitle && (
                          <p className="text-xs text-slate-500 truncate">{item.subtitle}</p>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0 capitalize">{item.type}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400 text-center">
                {results.length} result{results.length !== 1 ? 's' : ''} · Press Enter to open first result
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

import React, { useEffect, useState, FormEvent } from 'react';
import { Panel, PrimaryButton, SectionKicker, StatusBadge as DuskStatusBadge } from '../shared/dusk-ui';

type ExperimentStatus = 'active' | 'paused' | 'ended';

interface Variant {
  id?: string;
  name: string;
  weight: number;
}

interface Experiment {
  id: string;
  name: string;
  tagId: string;
  tagName?: string;
  status: ExperimentStatus;
  variants: Variant[];
  createdAt: string;
}

interface VariantResult {
  variantId: string;
  variantName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  isWinner: boolean;
}

interface ExperimentResults {
  experimentId: string;
  variants: VariantResult[];
  totalImpressions: number;
  enoughData: boolean;
}

interface Tag {
  id: string;
  name: string;
}

const statusBadge = (status: ExperimentStatus) => {
  const cfg: Record<ExperimentStatus, { tone: 'healthy' | 'warning' | 'neutral'; label: string }> = {
    active: { tone: 'healthy', label: 'Active' },
    paused: { tone: 'warning', label: 'Paused' },
    ended:  { tone: 'neutral', label: 'Ended' },
  };
  const { tone, label } = cfg[status];
  return <DuskStatusBadge tone={tone}>{label}</DuskStatusBadge>;
};

function normalizeExperimentStatus(status: unknown): ExperimentStatus {
  if (status === 'running' || status === 'active') return 'active';
  if (status === 'completed' || status === 'ended') return 'ended';
  return 'paused';
}

function toApiExperimentStatus(status: ExperimentStatus): string {
  if (status === 'active') return 'running';
  if (status === 'ended') return 'completed';
  return 'paused';
}

function normalizeExperiment(raw: any): Experiment {
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? 'Untitled experiment'),
    tagId: String(raw?.tagId ?? raw?.tag_id ?? ''),
    tagName: raw?.tagName ?? raw?.tag_name ?? undefined,
    status: normalizeExperimentStatus(raw?.status),
    variants: Array.isArray(raw?.variants) ? raw.variants.map((variant: any) => ({
      id: variant?.id ? String(variant.id) : undefined,
      name: String(variant?.name ?? 'Variant'),
      weight: Number(variant?.weight ?? 0) || 0,
    })) : [],
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? new Date().toISOString()),
  };
}

function ResultsModal({ experiment, onClose }: { experiment: Experiment; onClose: () => void }) {
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/v1/experiments/${experiment.id}/results`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load results'); return r.json(); })
      .then(d => {
        const payload = d?.results ?? d ?? {};
        const variants = Array.isArray(payload?.variants) ? payload.variants : [];
        const normalized: ExperimentResults = {
          experimentId: String(payload?.experiment?.id ?? experiment.id),
          variants: variants.map((variant: any) => ({
            variantId: String(variant?.variantId ?? variant?.id ?? ''),
            variantName: String(variant?.variantName ?? variant?.name ?? 'Variant'),
            impressions: Number(variant?.impressions ?? 0) || 0,
            clicks: Number(variant?.clicks ?? 0) || 0,
            ctr: Number(variant?.ctr ?? 0) || 0,
            isWinner: String(payload?.summary?.winner ?? '') === String(variant?.id ?? variant?.variantId ?? ''),
          })),
          totalImpressions: Number(payload?.totalImpressions ?? payload?.summary?.totalImpressions ?? 0) || 0,
          enoughData: Number(payload?.summary?.totalImpressions ?? 0) >= 100,
        };
        setResults(normalized);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [experiment.id]);

  const maxCtr = results ? Math.max(...results.variants.map(v => v.ctr), 0.001) : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{experiment.name}</h2>
            <p className="text-sm text-slate-500">Experiment Results</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : error ? (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          ) : !results ? (
            <p className="text-center text-slate-400 py-8">No results available</p>
          ) : (
            <>
              {!results.enoughData && (
                <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  ⚠️ Not enough data for statistical significance. Keep the experiment running.
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm text-slate-500">
                  Total impressions: <strong className="text-slate-800">{results.totalImpressions.toLocaleString()}</strong>
                </p>
              </div>

              <div className="space-y-4">
                {results.variants.map(v => (
                  <div key={v.variantId} className={`rounded-xl border p-4 ${v.isWinner && results.enoughData ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{v.variantName}</span>
                        {v.isWinner && results.enoughData && (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            🏆 Winner
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-indigo-700">{v.ctr.toFixed(3)}% CTR</span>
                    </div>

                    {/* CTR bar */}
                    <div className="mb-3">
                      <div className="w-full h-2 bg-slate-100 rounded-full">
                        <div
                          className={`h-2 rounded-full transition-all ${v.isWinner && results.enoughData ? 'bg-green-500' : 'bg-indigo-500'}`}
                          style={{ width: `${(v.ctr / maxCtr) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                      <div>
                        <span className="block text-slate-400">Impressions</span>
                        <strong className="text-slate-700">{v.impressions.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="block text-slate-400">Clicks</span>
                        <strong className="text-slate-700">{v.clicks.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateModal({ tags, onClose, onCreated }: {
  tags: Tag[];
  onClose: () => void;
  onCreated: (exp: Experiment) => void;
}) {
  const [name, setName] = useState('');
  const [tagId, setTagId] = useState('');
  const [variants, setVariants] = useState<Variant[]>([
    { name: 'Control', weight: 50 },
    { name: 'Variant A', weight: 50 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  const weightValid = totalWeight === 100;

  const addVariant = () => setVariants(vs => [...vs, { name: `Variant ${String.fromCharCode(64 + vs.length)}`, weight: 0 }]);
  const removeVariant = (i: number) => setVariants(vs => vs.filter((_, idx) => idx !== i));
  const setVariantField = (i: number, field: keyof Variant, val: string | number) =>
    setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, [field]: val } : v));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Experiment name is required.'); return; }
    if (!tagId) { setError('Select a tag.'); return; }
    if (variants.length < 2) { setError('At least 2 variants required.'); return; }
    if (!weightValid) { setError(`Variant weights must sum to 100 (currently ${totalWeight}).`); return; }
    if (variants.some(v => !v.name.trim())) { setError('All variants must have a name.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/v1/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), tagId, variants }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? 'Failed to create experiment');
      }
      const data = await res.json();
      onCreated(normalizeExperiment(data?.experiment ?? data));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">New Experiment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-6">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Experiment Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Homepage CTA Test"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tag <span className="text-red-500">*</span>
              </label>
              <select
                value={tagId}
                onChange={e => setTagId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select tag —</option>
                {tags.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">
                  Variants
                  {!weightValid && (
                    <span className="ml-2 text-xs text-red-500">Weights: {totalWeight}/100</span>
                  )}
                  {weightValid && (
                    <span className="ml-2 text-xs text-green-600">✓ 100%</span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={addVariant}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  + Add Variant
                </button>
              </div>
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={e => setVariantField(i, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Variant name"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={v.weight}
                        onChange={e => setVariantField(i, 'weight', Number(e.target.value))}
                        className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                    {variants.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeVariant(i)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                )}
                {saving ? 'Creating...' : 'Create Experiment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AbExperimentEditor() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/v1/experiments', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); }),
      fetch('/v1/tags', { credentials: 'include' }).then(r => r.json()).catch(() => ({ tags: [] })),
    ])
      .then(([expData, tagData]) => {
        setExperiments((expData?.experiments ?? expData ?? []).map(normalizeExperiment));
        setTags(tagData?.tags ?? tagData ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreated = (exp: Experiment) => {
    setExperiments(es => [exp, ...es]);
    setShowCreateModal(false);
  };

  const handleToggleStatus = async (exp: Experiment, newStatus: ExperimentStatus) => {
    try {
      const res = await fetch(`/v1/experiments/${exp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: toApiExperimentStatus(newStatus) }),
      });
      if (!res.ok) throw new Error('Update failed');
      setExperiments(es => es.map(e => e.id === exp.id ? { ...e, status: newStatus } : e));
    } catch {
      alert('Failed to update experiment status.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-fuchsia-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading experiments</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="dusk-page-header">
        <div>
          <SectionKicker>Experiments</SectionKicker>
          <h1 className="dusk-title mt-3">A/B Experiments</h1>
          <p className="dusk-copy mt-2">Test creative variants and compare lift from one consistent operations surface.</p>
        </div>
        <PrimaryButton onClick={() => setShowCreateModal(true)}>New Experiment</PrimaryButton>
      </div>

      {experiments.length === 0 ? (
        <Panel className="px-6 py-20 text-center">
          <SectionKicker>No experiments</SectionKicker>
          <h3 className="mt-3 text-lg font-medium text-slate-700 dark:text-white">No experiments yet</h3>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-white/[0.56]">Create an A/B test to optimize your ad performance.</p>
          <div className="flex justify-center">
            <PrimaryButton onClick={() => setShowCreateModal(true)}>New Experiment</PrimaryButton>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {experiments.map(exp => (
            <Panel key={exp.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-slate-800">{exp.name}</h3>
                    {statusBadge(exp.status)}
                  </div>
                  <p className="text-sm text-slate-500 mb-3">
                    Tag: <strong className="text-slate-700">{exp.tagName ?? exp.tagId}</strong>
                    <span className="mx-2">·</span>
                    Created {new Date(exp.createdAt).toLocaleDateString()}
                  </p>

                  {/* Variant pills */}
                  <div className="flex flex-wrap gap-2">
                    {exp.variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs">
                        <span className="font-medium text-slate-700">{v.name}</span>
                        <span className="text-slate-400">{v.weight}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setSelectedExperiment(exp)}
                    className="text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    📊 Results
                  </button>

                  {exp.status === 'active' && (
                    <button
                      onClick={() => handleToggleStatus(exp, 'paused')}
                      className="text-sm text-yellow-700 border border-yellow-200 hover:bg-yellow-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ⏸ Pause
                    </button>
                  )}
                  {exp.status === 'paused' && (
                    <button
                      onClick={() => handleToggleStatus(exp, 'active')}
                      className="text-sm text-green-700 border border-green-200 hover:bg-green-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ▶ Resume
                    </button>
                  )}
                  {exp.status !== 'ended' && (
                    <button
                      onClick={() => handleToggleStatus(exp, 'ended')}
                      className="text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      ■ End
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateModal
          tags={tags}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedExperiment && (
        <ResultsModal
          experiment={selectedExperiment}
          onClose={() => setSelectedExperiment(null)}
        />
      )}
    </div>
  );
}

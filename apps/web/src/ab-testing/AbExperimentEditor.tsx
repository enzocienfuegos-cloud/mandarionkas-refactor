import React, { useEffect, useState, FormEvent } from 'react';

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
  const cfg: Record<ExperimentStatus, { cls: string; label: string }> = {
    active: { cls: 'bg-green-100 text-green-800',   label: '● Active' },
    paused: { cls: 'bg-yellow-100 text-yellow-800', label: '⏸ Paused' },
    ended:  { cls: 'bg-slate-100 text-slate-600',   label: '■ Ended' },
  };
  const { cls, label } = cfg[status];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
};

function ResultsModal({ experiment, onClose }: { experiment: Experiment; onClose: () => void }) {
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/v1/experiments/${experiment.id}/results`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load results'); return r.json(); })
      .then(d => setResults(d))
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
      onCreated(data);
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
        setExperiments(expData?.experiments ?? expData ?? []);
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
        body: JSON.stringify({ status: newStatus }),
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading experiments</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">A/B Experiments</h1>
          <p className="text-sm text-slate-500 mt-1">Test creative variants and measure performance</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + New Experiment
        </button>
      </div>

      {experiments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">🧪</p>
          <h3 className="text-lg font-medium text-slate-700">No experiments yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Create an A/B test to optimize your ad performance.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            + New Experiment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {experiments.map(exp => (
            <div key={exp.id} className="bg-white rounded-xl border border-slate-200 p-5">
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
            </div>
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

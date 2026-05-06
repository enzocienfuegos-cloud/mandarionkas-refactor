import React, { useEffect, useState } from 'react';
import { Badge, Button, CenteredSpinner, Kicker, Panel, useToast } from '../system';
import { CreateExperimentModal } from './experiment-editor/CreateExperimentModal';
import { ExperimentResultsModal } from './experiment-editor/ExperimentResultsModal';
import { normalizeExperiment, toApiExperimentStatus, type Experiment, type ExperimentStatus, type Tag } from './experiment-editor/types';

const statusBadge = (status: ExperimentStatus) => {
  const cfg: Record<ExperimentStatus, { tone: 'success' | 'warning' | 'neutral'; label: string }> = {
    active: { tone: 'success', label: 'Active' },
    paused: { tone: 'warning', label: 'Paused' },
    ended:  { tone: 'neutral', label: 'Ended' },
  };
  const { tone, label } = cfg[status];
  return <Badge tone={tone}>{label}</Badge>;
};

export default function AbExperimentEditor() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const { toast } = useToast();

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
      toast({ tone: 'success', title: 'Experiment updated', description: `Status changed to ${newStatus}.` });
    } catch {
      toast({ tone: 'critical', title: 'Update failed', description: 'Failed to update experiment status.' });
    }
  };

  if (loading) {
    return <CenteredSpinner label="Loading experiments…" />;
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading experiments</p>
        <p className="text-sm mt-1">{error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="dusk-page-header">
        <div>
          <Kicker>Experiments</Kicker>
          <h1 className="dusk-title mt-3">A/B Experiments</h1>
          <p className="dusk-copy mt-2">Test creative variants and compare lift from one consistent operations surface.</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>New Experiment</Button>
      </div>

      {experiments.length === 0 ? (
        <Panel className="px-6 py-20 text-center">
          <Kicker>No experiments</Kicker>
          <h3 className="mt-3 text-lg font-medium text-slate-700 dark:text-white">No experiments yet</h3>
          <p className="mt-1 mb-4 text-sm text-slate-500 dark:text-white/[0.56]">Create an A/B test to optimize your ad performance.</p>
          <div className="flex justify-center">
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>New Experiment</Button>
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
                  <Button
                    onClick={() => setSelectedExperiment(exp)}
                    variant="secondary"
                    size="sm"
                  >
                    Results
                  </Button>

                  {exp.status === 'active' && (
                    <Button
                      onClick={() => handleToggleStatus(exp, 'paused')}
                      variant="secondary"
                      size="sm"
                    >
                      Pause
                    </Button>
                  )}
                  {exp.status === 'paused' && (
                    <Button
                      onClick={() => handleToggleStatus(exp, 'active')}
                      variant="secondary"
                      size="sm"
                    >
                      Resume
                    </Button>
                  )}
                  {exp.status !== 'ended' && (
                    <Button
                      onClick={() => handleToggleStatus(exp, 'ended')}
                      variant="ghost"
                      size="sm"
                    >
                      End
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateExperimentModal
          tags={tags}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedExperiment && (
        <ExperimentResultsModal
          experiment={selectedExperiment}
          onClose={() => setSelectedExperiment(null)}
        />
      )}
    </div>
  );
}

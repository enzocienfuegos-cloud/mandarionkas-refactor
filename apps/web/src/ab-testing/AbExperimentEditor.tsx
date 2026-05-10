import React, { useEffect, useState } from 'react';
import { Badge, Button, CenteredSpinner, EmptyState, Kicker, PageHeader, Panel, useToast } from '../system';
import { CreateExperimentModal } from './experiment-editor/CreateExperimentModal';
import { ExperimentResultsModal } from './experiment-editor/ExperimentResultsModal';
import { normalizeExperiment, toApiExperimentStatus, type Experiment, type ExperimentStatus, type Tag } from './experiment-editor/types';
import { FlaskConical } from '../system/icons';

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
      fetch('/v1/experiments', { credentials: 'include' }).then(r => { if (!r.ok) throw new Error('We could not load experiment traffic rules for this workspace.'); return r.json(); }),
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
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]" role="status" aria-live="polite">
        <p className="font-medium">Couldn&apos;t load experiments</p>
        <p className="mt-1 text-sm">Check workspace access or retry after the experiments service responds. Details: {error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Experiments"
        title="A/B Experiments"
        meta={`${experiments.length} experiments · compare creative lift from one consistent operations surface`}
        primaryAction={<Button variant="primary" onClick={() => setShowCreateModal(true)}>New Experiment</Button>}
      />

      {experiments.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<FlaskConical />}
            kicker="No experiments"
            title="No experiments yet"
            description="Create an A/B test to optimize creative performance before you scale traffic."
            action={<Button variant="primary" onClick={() => setShowCreateModal(true)}>New Experiment</Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {experiments.map(exp => (
            <Panel key={exp.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-[color:var(--dusk-text-primary)]">{exp.name}</h3>
                    {statusBadge(exp.status)}
                  </div>
                  <p className="mb-3 text-sm text-[color:var(--dusk-text-muted)]">
                    Tag: <strong className="text-[color:var(--dusk-text-secondary)]">{exp.tagName ?? exp.tagId}</strong>
                    <span className="mx-2">·</span>
                    Created {new Date(exp.createdAt).toLocaleDateString()}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {exp.variants.map((v, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-full border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-3 py-1 text-xs">
                        <span className="font-medium text-[color:var(--dusk-text-secondary)]">{v.name}</span>
                        <span className="text-[color:var(--dusk-text-muted)]">{v.weight}%</span>
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

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  Pause,
  Play,
  Stop as StopIcon,
  TrendingUp,
  FlaskConical,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  FormField,
  Kicker,
  Badge,
  CenteredSpinner,
  Modal,
  useToast,
  useConfirm,
} from '../system';

type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

interface Variant {
  id: string;
  name: string;
  trafficShare: number;
  impressions?: number;
  conversions?: number;
}

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  metric: string;
  variants: Variant[];
  startedAt?: string;
  endedAt?: string;
}

const statusToneMap: Record<ExperimentStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  draft:     'neutral',
  running:   'info',
  paused:    'warning',
  completed: 'success',
};

/**
 * A/B experiment editor — refactored to the Dusk design system (S56).
 *
 * Replaces:
 *   - Emoji buttons (📊 Results / ⏸ Pause / ▶ Resume / ■ End) with
 *     proper lucide icons + Button variants.
 *   - Hardcoded green-600 / red-600 colors with semantic tones.
 *   - window.confirm() with the typed-confirm Modal.
 */
export default function AbExperimentEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm   = useConfirm();
  const isEdit = Boolean(id && id !== 'new');

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading]       = useState(isEdit);
  const [saving, setSaving]         = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setExperiment({
        id: '',
        name: '',
        hypothesis: '',
        status: 'draft',
        metric: 'ctr',
        variants: [
          { id: 'a', name: 'Control', trafficShare: 50 },
          { id: 'b', name: 'Variant B', trafficShare: 50 },
        ],
      });
      return;
    }

    setLoading(true);
    fetch(`/v1/experiments/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setExperiment(data?.experiment ?? data))
      .catch(() => toast({ tone: 'critical', title: 'Failed to load experiment' }))
      .finally(() => setLoading(false));
  }, [id, isEdit, toast]);

  const updateField = <K extends keyof Experiment>(field: K, value: Experiment[K]) => {
    setExperiment((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateVariant = (idx: number, field: keyof Variant, value: string | number) => {
    setExperiment((current) => {
      if (!current) return current;
      const next = [...current.variants];
      next[idx] = { ...next[idx], [field]: value };
      return { ...current, variants: next };
    });
  };

  const handleSave = async () => {
    if (!experiment) return;
    setSaving(true);
    try {
      const url    = isEdit ? `/v1/experiments/${id}` : '/v1/experiments';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(experiment),
      });
      if (!res.ok) throw new Error('save failed');
      toast({ tone: 'success', title: isEdit ? 'Experiment updated' : 'Experiment created' });
      navigate('/experiments');
    } catch {
      toast({ tone: 'critical', title: 'Could not save experiment' });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusTransition = async (next: ExperimentStatus) => {
    if (!experiment) return;

    if (next === 'completed') {
      const ok = await confirm({
        title: 'End this experiment?',
        description: 'Stopping is permanent. Traffic will revert to the control variant.',
        tone: 'danger',
        confirmLabel: 'End experiment',
      });
      if (!ok) return;
    }

    try {
      const res = await fetch(`/v1/experiments/${experiment.id}/${next}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('status change failed');
      setExperiment({ ...experiment, status: next });
      toast({
        tone: next === 'completed' ? 'warning' : 'success',
        title: `Experiment ${next}`,
      });
    } catch {
      toast({ tone: 'critical', title: 'Could not update status' });
    }
  };

  if (loading || !experiment) return <CenteredSpinner label="Loading experiment…" />;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Kicker>{isEdit ? 'Experiment' : 'New experiment'}</Kicker>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            {experiment.name || 'Untitled experiment'}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={statusToneMap[experiment.status]} dot>{experiment.status}</Badge>
            {experiment.startedAt && (
              <span className="text-xs text-[color:var(--dusk-text-muted)]">
                Started {new Date(experiment.startedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isEdit && (
            <Button variant="secondary" leadingIcon={<BarChart3 />} onClick={() => setResultsOpen(true)}>
              Results
            </Button>
          )}
          {experiment.status === 'running' && (
            <Button variant="secondary" leadingIcon={<Pause />} onClick={() => handleStatusTransition('paused')}>
              Pause
            </Button>
          )}
          {experiment.status === 'paused' && (
            <Button variant="primary" leadingIcon={<Play />} onClick={() => handleStatusTransition('running')}>
              Resume
            </Button>
          )}
          {(experiment.status === 'running' || experiment.status === 'paused') && (
            <Button variant="danger" leadingIcon={<StopIcon />} onClick={() => handleStatusTransition('completed')}>
              End
            </Button>
          )}
        </div>
      </header>

      <Panel padding="lg">
        <PanelHeader title="Hypothesis" subtitle="What you expect to happen and why" />
        <div className="space-y-5">
          <FormField label="Experiment name" required>
            <Input value={experiment.name} onChange={(e) => updateField('name', e.target.value)} />
          </FormField>
          <FormField label="Hypothesis">
            <textarea
              value={experiment.hypothesis}
              onChange={(e) => updateField('hypothesis', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-primary)] outline-none transition hover:border-[color:var(--dusk-border-strong)]"
              placeholder="If we change X, we expect metric Y to move because…"
            />
          </FormField>
          <FormField label="Primary metric">
            <Select
              value={experiment.metric}
              onChange={(e) => updateField('metric', e.target.value)}
              options={[
                { value: 'ctr',           label: 'CTR' },
                { value: 'conversion',    label: 'Conversion rate' },
                { value: 'viewability',   label: 'Viewability' },
                { value: 'completion',    label: 'Video completion rate' },
              ]}
            />
          </FormField>
        </div>
      </Panel>

      <Panel padding="lg" className="mt-4">
        <PanelHeader
          title="Variants"
          subtitle="Traffic share must total 100%"
          kicker={<span className="inline-flex items-center gap-1.5"><FlaskConical className="h-3 w-3" />A/B</span>}
        />
        <div className="space-y-3">
          {experiment.variants.map((variant, idx) => (
            <div
              key={variant.id}
              className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)]"
            >
              <FormField label={idx === 0 ? 'Control name' : `Variant ${String.fromCharCode(65 + idx)} name`} className="col-span-6">
                <Input value={variant.name} onChange={(e) => updateVariant(idx, 'name', e.target.value)} />
              </FormField>
              <FormField label="Traffic share %" className="col-span-3">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={variant.trafficShare}
                  onChange={(e) => updateVariant(idx, 'trafficShare', Number(e.target.value))}
                />
              </FormField>
              {variant.impressions != null && (
                <div className="col-span-3">
                  <Kicker>Delivered</Kicker>
                  <p className="mt-1 text-sm font-semibold tabular text-[color:var(--dusk-text-primary)]">
                    {variant.impressions.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <div
        className="sticky bottom-0 mt-6 -mx-6 px-6 py-4 bg-surface-1 border-t border-[color:var(--dusk-border-default)] backdrop-blur-xl"
        style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate('/experiments')}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {isEdit ? 'Save changes' : 'Create experiment'}
          </Button>
        </div>
      </div>

      <Modal
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        title="Experiment results"
        description={experiment.name}
        size="lg"
        footer={<Button variant="primary" onClick={() => setResultsOpen(false)}>Close</Button>}
      >
        <div className="space-y-3">
          {experiment.variants.map((variant) => {
            const conversionRate =
              variant.impressions && variant.conversions
                ? (variant.conversions / variant.impressions) * 100
                : null;
            return (
              <div
                key={variant.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--dusk-border-default)]"
              >
                <div>
                  <p className="text-sm font-medium text-[color:var(--dusk-text-primary)]">{variant.name}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--dusk-text-muted)]">
                    {variant.trafficShare}% traffic · {variant.impressions?.toLocaleString() ?? 0} impressions
                  </p>
                </div>
                <div className="text-right">
                  <Kicker>{experiment.metric}</Kicker>
                  <p className="mt-1 inline-flex items-center gap-1 text-lg font-semibold tabular text-[color:var(--dusk-text-primary)]">
                    {conversionRate != null ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-[color:var(--dusk-status-success-fg)]" />
                        {conversionRate.toFixed(2)}%
                      </>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

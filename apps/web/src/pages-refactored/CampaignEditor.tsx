import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listSupportedDsps } from '@smx/contracts/dsp-macros';
import { loadWorkspaces, type WorkspaceOption } from '../shared/workspaces';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  FormField,
  Kicker,
  CenteredSpinner,
  useToast,
} from '../system';

const DSP_OPTIONS = [
  { value: '', label: '— None —' },
  ...listSupportedDsps().map((dsp) => ({ value: dsp.label, label: dsp.label })),
];

const STATUSES = [
  { value: 'draft',    label: 'Draft' },
  { value: 'active',   label: 'Active' },
  { value: 'paused',   label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

const MEDIA_TYPES = [
  { value: 'display', label: 'Display / Interactive' },
  { value: 'video',   label: 'Video' },
];

interface CampaignForm {
  workspaceId: string;
  name: string;
  dsp: string;
  mediaType: string;
  status: string;
  startDate: string;
  endDate: string;
  impressionGoal: string;
  dailyBudget: string;
}

const emptyForm: CampaignForm = {
  workspaceId: '',
  name: '',
  dsp: '',
  mediaType: 'display',
  status: 'draft',
  startDate: '',
  endDate: '',
  impressionGoal: '',
  dailyBudget: '',
};

/**
 * Campaign editor — refactored to the Dusk design system (S56).
 *
 * Layout: two-column form on desktop, single-column on mobile.
 * Sticky save bar at the bottom for fast confirmation.
 * Validation is inline. No more legacy indigo styles.
 */
export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast }  = useToast();
  const isEdit = Boolean(id && id !== 'new');

  const [form, setForm]               = useState<CampaignForm>(emptyForm);
  const [errors, setErrors]           = useState<Partial<CampaignForm>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading]         = useState(isEdit);
  const [saving, setSaving]           = useState(false);
  const [workspaces, setWorkspaces]   = useState<WorkspaceOption[]>([]);

  useEffect(() => {
    if (!isEdit) {
      setLoading(true);
      loadWorkspaces()
        .then(setWorkspaces)
        .catch(() => setGeneralError('Failed to load clients.'))
        .finally(() => setLoading(false));
      return;
    }

    setLoading(true);
    fetch(`/v1/campaigns/${id}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        const c = data?.campaign ?? data;
        setForm({
          workspaceId:    c.workspaceId ?? c.workspace_id ?? '',
          name:           c.name ?? '',
          dsp:            c.metadata?.dsp ?? '',
          mediaType:      c.metadata?.mediaType ?? 'display',
          status:         c.status ?? 'draft',
          startDate:      c.startDate ? c.startDate.slice(0, 10) : (c.start_date ? c.start_date.slice(0, 10) : ''),
          endDate:        c.endDate ? c.endDate.slice(0, 10) : (c.end_date ? c.end_date.slice(0, 10) : ''),
          impressionGoal: c.impressionGoal != null ? String(c.impressionGoal) : (c.impression_goal != null ? String(c.impression_goal) : ''),
          dailyBudget:    c.dailyBudget != null ? String(c.dailyBudget) : (c.daily_budget != null ? String(c.daily_budget) : ''),
        });
      })
      .catch(() => setGeneralError('Failed to load campaign.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (field: keyof CampaignForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: event.target.value }));
      setErrors((er) => ({ ...er, [field]: undefined }));
    };

  const validate = (): Partial<CampaignForm> => {
    const errs: Partial<CampaignForm> = {};
    if (!isEdit && !form.workspaceId) errs.workspaceId = 'Client is required.';
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (form.impressionGoal && Number.isNaN(Number(form.impressionGoal))) errs.impressionGoal = 'Must be a number.';
    if (form.dailyBudget && Number.isNaN(Number(form.dailyBudget))) errs.dailyBudget = 'Must be a number.';
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      errs.endDate = 'End date must be after start date.';
    }
    return errs;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setGeneralError('');

    const payload = {
      ...(isEdit ? {} : { workspaceId: form.workspaceId }),
      name: form.name.trim(),
      metadata: { dsp: form.dsp || null, mediaType: form.mediaType },
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      impressionGoal: form.impressionGoal ? Number(form.impressionGoal) : null,
      dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : null,
    };

    try {
      const url = isEdit ? `/v1/campaigns/${id}` : '/v1/campaigns';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `${method} failed`);
      }

      toast({
        tone: 'success',
        title: isEdit ? 'Campaign updated' : 'Campaign created',
        description: form.name,
      });
      navigate('/campaigns');
    } catch (saveError: any) {
      setGeneralError(saveError?.message ?? 'Failed to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CenteredSpinner label="Loading campaign…" />;

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <header className="mb-6">
        <Kicker>{isEdit ? 'Edit campaign' : 'New campaign'}</Kicker>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
          {isEdit ? form.name || 'Untitled campaign' : 'Create a new campaign'}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
          Trafficking-grade setup. Fields with * are required to save.
        </p>
      </header>

      {generalError && (
        <Panel padding="md" className="mb-4 border-[color:var(--dusk-status-critical-border)]">
          <p className="text-sm font-medium text-[color:var(--dusk-status-critical-fg)]">{generalError}</p>
        </Panel>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Panel padding="lg">
          <PanelHeader title="Basics" subtitle="Identification and ownership of the campaign" />

          <div className="space-y-5">
            {!isEdit && (
              <FormField
                label="Client"
                required
                error={errors.workspaceId}
                helper="The advertiser who owns this campaign."
              >
                <Select
                  value={form.workspaceId}
                  onChange={set('workspaceId')}
                  invalid={Boolean(errors.workspaceId)}
                >
                  <option value="">Select a client</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </FormField>
            )}

            <FormField
              label="Campaign name"
              required
              error={errors.name}
            >
              <Input
                value={form.name}
                onChange={set('name')}
                invalid={Boolean(errors.name)}
                placeholder="e.g. Q4 Brand Awareness"
              />
            </FormField>
          </div>
        </Panel>

        <Panel padding="lg" className="mt-4">
          <PanelHeader title="Delivery setup" subtitle="DSP, media type and lifecycle" />

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="DSP" helper="Determines the click & view macros generated for tags.">
              <Select value={form.dsp} onChange={set('dsp')}>
                {DSP_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Media type">
              <Select value={form.mediaType} onChange={set('mediaType')} options={MEDIA_TYPES} />
            </FormField>

            <FormField label="Status" className="md:col-span-2">
              <Select value={form.status} onChange={set('status')} options={STATUSES} />
            </FormField>
          </div>
        </Panel>

        <Panel padding="lg" className="mt-4">
          <PanelHeader title="Flight & budget" subtitle="Schedule and pacing targets" />

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Start date">
              <Input type="date" value={form.startDate} onChange={set('startDate')} />
            </FormField>

            <FormField label="End date" error={errors.endDate}>
              <Input
                type="date"
                value={form.endDate}
                onChange={set('endDate')}
                invalid={Boolean(errors.endDate)}
              />
            </FormField>

            <FormField label="Impression goal" error={errors.impressionGoal}>
              <Input
                type="number"
                min="0"
                value={form.impressionGoal}
                onChange={set('impressionGoal')}
                invalid={Boolean(errors.impressionGoal)}
                placeholder="1000000"
              />
            </FormField>

            <FormField label="Daily budget (USD)" error={errors.dailyBudget}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.dailyBudget}
                onChange={set('dailyBudget')}
                invalid={Boolean(errors.dailyBudget)}
                placeholder="500.00"
              />
            </FormField>
          </div>
        </Panel>

        {/* Sticky save bar */}
        <div
          className="sticky bottom-0 mt-6 -mx-6 px-6 py-4 bg-surface-1 border-t border-[color:var(--dusk-border-default)] backdrop-blur-xl"
          style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => navigate('/campaigns')}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              {isEdit ? 'Update campaign' : 'Create campaign'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

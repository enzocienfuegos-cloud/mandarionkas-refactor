import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listSupportedDsps } from '@smx/contracts/dsp-macros';
import { loadWorkspaces, type WorkspaceOption } from '../shared/workspaces';
import { Button, CenteredSpinner, Input, Panel, Kicker } from '../system';

const DSP_OPTIONS = [
  { value: '', label: '— None —' },
  ...listSupportedDsps().map((dsp) => ({ value: dsp.label, label: dsp.label })),
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

const STATUSES = ['draft', 'active', 'paused', 'archived'];

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

export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id && id !== 'new');

  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<CampaignForm>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);

  useEffect(() => {
    if (!isEdit) {
      setLoading(true);
      loadWorkspaces()
        .then((workspaceList) => {
          setWorkspaces(workspaceList);
        })
        .catch(() => setGeneralError('Failed to load clients.'))
        .finally(() => setLoading(false));
      return;
    }

    if (!isEdit) return;
    setLoading(true);
    fetch(`/v1/campaigns/${id}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => {
        const campaign = data?.campaign ?? data;
        setForm({
          workspaceId: campaign.workspaceId ?? campaign.workspace_id ?? '',
          name: campaign.name ?? '',
          dsp: campaign.metadata?.dsp ?? '',
          mediaType: campaign.metadata?.mediaType ?? 'display',
          status: campaign.status ?? 'draft',
          startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : (campaign.start_date ? campaign.start_date.slice(0, 10) : ''),
          endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : (campaign.end_date ? campaign.end_date.slice(0, 10) : ''),
          impressionGoal: campaign.impressionGoal != null ? String(campaign.impressionGoal) : (campaign.impression_goal != null ? String(campaign.impression_goal) : ''),
          dailyBudget: campaign.dailyBudget != null ? String(campaign.dailyBudget) : (campaign.daily_budget != null ? String(campaign.daily_budget) : ''),
        });
      })
      .catch(() => setGeneralError('Failed to load campaign.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (field: keyof CampaignForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const validate = (): Partial<CampaignForm> => {
    const errs: Partial<CampaignForm> = {};
    if (!isEdit && !form.workspaceId) errs.workspaceId = 'Client is required.';
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (form.impressionGoal && isNaN(Number(form.impressionGoal))) errs.impressionGoal = 'Must be a number.';
    if (form.dailyBudget && isNaN(Number(form.dailyBudget))) errs.dailyBudget = 'Must be a number.';
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      errs.endDate = 'End date must be after start date.';
    }
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    const body = {
      workspaceId: isEdit ? undefined : form.workspaceId || null,
      name: form.name.trim(),
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      impressionGoal: form.impressionGoal ? Number(form.impressionGoal) : null,
      dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : null,
      metadata: {
        dsp: form.dsp || null,
        mediaType: form.mediaType || 'display',
      },
    };

    try {
      const url = isEdit ? `/v1/campaigns/${id}` : '/v1/campaigns';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        navigate('/campaigns');
      } else {
        const data = await res.json().catch(() => ({}));
        setGeneralError(data?.message ?? 'Failed to save campaign.');
      }
    } catch {
      setGeneralError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CenteredSpinner label="Loading campaign editor…" />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Kicker>Campaigns</Kicker>
        <h1 className="mt-3 text-2xl font-semibold text-slate-800 dark:text-white">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h1>
      </div>

      <Panel className="rounded-xl">
        {generalError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <select value={form.workspaceId} onChange={set('workspaceId')} className={`w-full rounded-lg border bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 ${errors.workspaceId ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10' : 'border-[color:var(--dusk-border-default)]'}`}>
                <option value="">Select a client</option>
                {workspaces.map(workspace => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
              {errors.workspaceId && <p className="mt-1 text-xs text-red-600">{errors.workspaceId}</p>}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={form.name}
              onChange={set('name')}
              className={errors.name ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10' : undefined}
              placeholder="Q4 Brand Awareness"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* DSP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">DSP</label>
            <select value={form.dsp} onChange={set('dsp')} className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500">
              {DSP_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Media Type</label>
            <select value={form.mediaType} onChange={set('mediaType')} className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500">
              <option value="display">Display / Interactive</option>
              <option value="video">Video</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={set('status')} className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500">
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <Input type="date" value={form.startDate} onChange={set('startDate')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <Input type="date" value={form.endDate} onChange={set('endDate')} className={errors.endDate ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10' : undefined} />
              {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
            </div>
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Impression Goal</label>
              <Input
                type="number"
                min="0"
                value={form.impressionGoal}
                onChange={set('impressionGoal')}
                className={errors.impressionGoal ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10' : undefined}
                placeholder="1000000"
              />
              {errors.impressionGoal && <p className="mt-1 text-xs text-red-600">{errors.impressionGoal}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily Budget ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.dailyBudget}
                onChange={set('dailyBudget')}
                className={errors.dailyBudget ? 'border-[color:var(--dusk-status-critical-fg)] bg-rose-50/70 dark:bg-rose-500/10' : undefined}
                placeholder="500.00"
              />
              {errors.dailyBudget && <p className="mt-1 text-xs text-red-600">{errors.dailyBudget}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => navigate('/campaigns')}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

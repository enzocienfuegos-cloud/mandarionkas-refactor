import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadWorkspaces, type WorkspaceOption } from '../shared/workspaces';
import { CenteredSpinner, Kicker, Panel } from '../system';
import { CampaignEditorForm } from './campaign-editor/CampaignEditorForm';
import { emptyForm } from './campaign-editor/constants';
import type { CampaignForm } from './campaign-editor/types';

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
        <h1 className="mt-3 text-2xl font-semibold text-text-primary">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h1>
      </div>

      <Panel className="rounded-xl">
        {generalError && (
          <Panel className="mb-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]" role="alert">
            {generalError}
          </Panel>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <CampaignEditorForm
            isEdit={isEdit}
            form={form}
            errors={errors}
            workspaces={workspaces}
            saving={saving}
            onFieldChange={set}
            onCancel={() => navigate('/campaigns')}
          />
        </form>
      </Panel>
    </div>
  );
}

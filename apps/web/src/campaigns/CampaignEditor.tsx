import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadWorkspaces, type WorkspaceOption } from '../shared/workspaces';
import { CenteredSpinner, Kicker, Panel, type DateRange } from '../system';
import { CampaignEditorForm } from './campaign-editor/CampaignEditorForm';
import { emptyForm } from './campaign-editor/constants';
import type { CampaignForm } from './campaign-editor/types';

function formatDateInputValue(value: Date | null) {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    setLoading(true);
    Promise.all([
      loadWorkspaces(),
      isEdit
        ? fetch(`/v1/campaigns/${id}`, { credentials: 'include' }).then((response) => {
            if (!response.ok) throw new Error('Not found');
            return response.json();
          })
        : Promise.resolve(null),
    ])
      .then(([workspaceList, campaignPayload]) => {
        setWorkspaces(workspaceList);
        if (!isEdit || !campaignPayload) return;
        const campaign = campaignPayload?.campaign ?? campaignPayload;
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
          lifetimeBudget: campaign.budget != null ? String(campaign.budget) : '',
          estimatedRate: campaign.estimatedRate != null ? String(campaign.estimatedRate) : String(campaign.metadata?.estimatedRate ?? ''),
          markupPercent: campaign.markupPercent != null ? String(campaign.markupPercent) : String(campaign.metadata?.markupPercent ?? ''),
          servingFeeCpm: campaign.servingFeeCpm != null ? String(campaign.servingFeeCpm) : String(campaign.metadata?.servingFeeCpm ?? ''),
          budgetDeliveryMode: String(campaign.budgetDeliveryMode ?? campaign.metadata?.budgetDeliveryMode ?? 'hybrid'),
          rateStrategy: String(campaign.rateStrategy ?? campaign.metadata?.rateStrategy ?? 'budget_only'),
          servingCostMode: String(campaign.servingCostMode ?? campaign.metadata?.servingCostMode ?? 'paid'),
        });
      })
      .catch(() => setGeneralError(isEdit
        ? 'Couldn’t load this campaign. It may have been removed or you may not have access to its workspace.'
        : 'Couldn’t load client workspaces. Refresh the page or try again with an account that can traffic campaigns.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (field: keyof CampaignForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const setValue = (field: keyof CampaignForm) => (value: string | string[]) => {
    setForm((current) => ({ ...current, [field]: Array.isArray(value) ? value[0] ?? '' : value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const setNumberField = (
    field: 'impressionGoal' | 'dailyBudget' | 'lifetimeBudget' | 'estimatedRate' | 'markupPercent' | 'servingFeeCpm',
  ) => (value: number | null) => {
    setForm((current) => ({ ...current, [field]: value == null ? '' : String(value) }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const setDateRange = (range: DateRange) => {
    setForm((current) => ({
      ...current,
      startDate: formatDateInputValue(range.from),
      endDate: formatDateInputValue(range.to),
    }));
    setErrors((current) => ({ ...current, startDate: undefined, endDate: undefined }));
  };

  const validate = (): Partial<CampaignForm> => {
    const errs: Partial<CampaignForm> = {};
    if (!form.workspaceId) errs.workspaceId = 'Client is required.';
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (form.impressionGoal && isNaN(Number(form.impressionGoal))) errs.impressionGoal = 'Must be a number.';
    if (form.dailyBudget && isNaN(Number(form.dailyBudget))) errs.dailyBudget = 'Must be a number.';
    if (form.lifetimeBudget && isNaN(Number(form.lifetimeBudget))) errs.lifetimeBudget = 'Must be a number.';
    if (form.estimatedRate && isNaN(Number(form.estimatedRate))) errs.estimatedRate = 'Must be a number.';
    if (form.markupPercent && isNaN(Number(form.markupPercent))) errs.markupPercent = 'Must be a number.';
    if (form.servingFeeCpm && isNaN(Number(form.servingFeeCpm))) errs.servingFeeCpm = 'Must be a number.';
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      errs.endDate = 'End date must be after start date.';
    }
    if (form.budgetDeliveryMode !== 'lifetime' && !form.dailyBudget) {
      errs.dailyBudget = 'Daily budget is required for this budget mode.';
    }
    if (form.budgetDeliveryMode !== 'daily' && !form.lifetimeBudget) {
      errs.lifetimeBudget = 'Lifetime budget is required for this budget mode.';
    }
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    const metadata = {
      dsp: form.dsp || null,
      mediaType: form.mediaType || 'display',
      estimatedRate: form.estimatedRate ? Number(form.estimatedRate) : null,
      markupPercent: form.markupPercent ? Number(form.markupPercent) : null,
      servingFeeCpm: form.servingFeeCpm ? Number(form.servingFeeCpm) : null,
      budgetDeliveryMode: form.budgetDeliveryMode,
      rateStrategy: form.rateStrategy,
      servingCostMode: form.servingCostMode,
    };
    const body = {
      workspaceId: form.workspaceId || null,
      name: form.name.trim(),
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      budget: form.lifetimeBudget ? Number(form.lifetimeBudget) : null,
      impressionGoal: form.impressionGoal ? Number(form.impressionGoal) : null,
      dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : null,
      metadata,
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
        setGeneralError(data?.message ?? 'Couldn’t save campaign changes. Check required fields and workspace permissions, then try again.');
      }
    } catch {
      setGeneralError('Couldn’t reach the campaign service. Check your connection and try saving again.');
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
            onValueChange={setValue}
            onNumberFieldChange={setNumberField}
            onDateRangeChange={setDateRange}
            onCancel={() => navigate('/campaigns')}
          />
        </form>
      </Panel>
    </div>
  );
}

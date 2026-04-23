import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const DSP_OPTIONS = ['Basis', 'Illumin', 'Criteo'] as const;

interface CampaignForm {
  name: string;
  dsp: string;
  status: string;
  startDate: string;
  endDate: string;
  impressionGoal: string;
  dailyBudget: string;
}

const STATUSES = ['draft', 'active', 'paused', 'archived'];

const emptyForm: CampaignForm = {
  name: '',
  dsp: '',
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

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fetch(`/v1/campaigns/${id}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(data => {
        setForm({
          name: data.name ?? '',
          dsp: data.metadata?.dsp ?? '',
          status: data.status ?? 'draft',
          startDate: data.startDate ? data.startDate.slice(0, 10) : '',
          endDate: data.endDate ? data.endDate.slice(0, 10) : '',
          impressionGoal: data.impressionGoal != null ? String(data.impressionGoal) : '',
          dailyBudget: data.dailyBudget != null ? String(data.dailyBudget) : '',
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
      name: form.name.trim(),
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      impressionGoal: form.impressionGoal ? Number(form.impressionGoal) : null,
      dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : null,
      metadata: {
        dsp: form.dsp || null,
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const inputClass = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
      err ? 'border-red-400 bg-red-50' : 'border-slate-300'
    }`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Edit Campaign' : 'New Campaign'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {generalError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              className={inputClass(errors.name)}
              placeholder="Q4 Brand Awareness"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* DSP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">DSP</label>
            <select value={form.dsp} onChange={set('dsp')} className={inputClass()}>
              <option value="">— Select DSP —</option>
              {DSP_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={set('status')} className={inputClass()}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={set('startDate')} className={inputClass()} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={set('endDate')} className={inputClass(errors.endDate)} />
              {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
            </div>
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Impression Goal</label>
              <input
                type="number"
                min="0"
                value={form.impressionGoal}
                onChange={set('impressionGoal')}
                className={inputClass(errors.impressionGoal)}
                placeholder="1000000"
              />
              {errors.impressionGoal && <p className="mt-1 text-xs text-red-600">{errors.impressionGoal}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.dailyBudget}
                onChange={set('dailyBudget')}
                className={inputClass(errors.dailyBudget)}
                placeholder="500.00"
              />
              {errors.dailyBudget && <p className="mt-1 text-xs text-red-600">{errors.dailyBudget}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/campaigns')}
              className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {saving ? 'Saving...' : isEdit ? 'Update Campaign' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

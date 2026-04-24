import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { applyDspMacrosToUrl, getDspMacroConfig, readCampaignDsp } from '@smx/contracts/dsp-macros';
import {
  assignCreativeVersionToTag,
  loadCreativesWithLatestVersion,
  loadTagBindings,
  type Creative,
  type CreativeVersion,
  type TagBinding,
} from '../creatives/catalog';

interface Campaign {
  id: string;
  name: string;
  metadata?: { dsp?: string | null } | null;
}

type TagFormat = 'VAST' | 'display' | 'native' | 'tracker';
type TagStatus = 'draft' | 'active' | 'paused' | 'archived';
type TrackerType = 'click' | 'impression';

interface TagForm {
  name: string;
  campaignId: string;
  format: TagFormat;
  status: TagStatus;
  clickUrl: string;
  servingWidth: string;
  servingHeight: string;
  trackerType: TrackerType;
}

interface SavedTag {
  id: string;
  format: TagFormat;
  name: string;
  width?: number | null;
  height?: number | null;
  sizeLabel?: string;
  trackerType?: TrackerType | null;
}

interface CreativeAssignmentOption {
  creative: Creative;
  latestVersion: CreativeVersion;
}

type SnippetVariant =
  | 'vast-url'
  | 'vast-xml'
  | 'display-js'
  | 'display-iframe'
  | 'display-ins'
  | 'native-js'
  | 'tracker-click'
  | 'tracker-impression';

const DISPLAY_SIZE_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

const emptyForm: TagForm = {
  name: '',
  campaignId: '',
  format: 'VAST',
  status: 'draft',
  clickUrl: '',
  servingWidth: '',
  servingHeight: '',
  trackerType: 'click',
};

const STATUSES: TagStatus[] = ['draft', 'active', 'paused', 'archived'];

function resolveTagServingBaseUrl() {
  const candidates = [
    import.meta.env.VITE_TAGS_BASE_URL,
    import.meta.env.VITE_API_BASE_URL,
    typeof window !== 'undefined' ? window.location.origin : '',
  ];

  return (candidates.find((candidate) => candidate?.trim()) ?? '').replace(/\/+$/, '');
}

function getDefaultSnippetVariant(format: TagFormat, trackerType: TrackerType | null = null): SnippetVariant {
  if (format === 'VAST') return 'vast-url';
  if (format === 'display') return 'display-js';
  if (format === 'tracker') return trackerType === 'impression' ? 'tracker-impression' : 'tracker-click';
  return 'native-js';
}

function getSnippetOptions(format: TagFormat, trackerType: TrackerType | null = null): Array<{ value: SnippetVariant; label: string }> {
  if (format === 'VAST') {
    return [
      { value: 'vast-url', label: 'VAST URL' },
      { value: 'vast-xml', label: 'XML Wrapper' },
    ];
  }
  if (format === 'display') {
    return [
      { value: 'display-js', label: 'JS Tag' },
      { value: 'display-iframe', label: 'Iframe Tag' },
      { value: 'display-ins', label: 'Ins Tag' },
    ];
  }
  if (format === 'tracker') {
    return trackerType === 'impression'
      ? [{ value: 'tracker-impression', label: 'Impression Pixel URL' }]
      : [{ value: 'tracker-click', label: 'Click Tracker URL' }];
  }
  return [{ value: 'native-js', label: 'JS Tag' }];
}

function normalizeTagRecord(payload: unknown): SavedTag | null {
  const source = (payload as { tag?: Record<string, unknown> } | null)?.tag
    ?? (payload as Record<string, unknown> | null);
  if (!source || typeof source !== 'object') return null;

  const format = source.format === 'display' || source.format === 'native' || source.format === 'VAST' || source.format === 'tracker'
    ? source.format
    : 'display';
  const creatives = Array.isArray(source.creatives) ? source.creatives : [];
  const firstCreative = creatives[0] as Record<string, unknown> | undefined;

  return {
    id: String(source.id ?? ''),
    format,
    name: String(source.name ?? ''),
    width: Number(source.servingWidth ?? firstCreative?.width ?? 0) || null,
    height: Number(source.servingHeight ?? firstCreative?.height ?? 0) || null,
    sizeLabel: String(source.sizeLabel ?? ''),
    trackerType: (source.trackerType === 'click' || source.trackerType === 'impression') ? source.trackerType : null,
  };
}

function buildTagSnippet(tag: SavedTag, variant: SnippetVariant, campaignDsp = ''): string {
  const servingBaseUrl = resolveTagServingBaseUrl();
  const displayJsUrl = applyDspMacrosToUrl(`${servingBaseUrl}/v1/tags/display/${tag.id}.js`, campaignDsp, { includeClickMacro: true });
  const displayHtmlUrl = applyDspMacrosToUrl(`${servingBaseUrl}/v1/tags/display/${tag.id}.html`, campaignDsp, { includeClickMacro: true });
  const nativeJsUrl = applyDspMacrosToUrl(`${servingBaseUrl}/v1/tags/native/${tag.id}.js`, campaignDsp, { includeClickMacro: true });
  const vastUrl = applyDspMacrosToUrl(`${servingBaseUrl}/v1/vast/tags/${tag.id}`, campaignDsp);
  const trackerClickUrl = applyDspMacrosToUrl(`${servingBaseUrl}/v1/tags/tracker/${tag.id}/click`, campaignDsp);
  const trackerImpressionUrl = applyDspMacrosToUrl(`${servingBaseUrl}/v1/tags/tracker/${tag.id}/impression.gif`, campaignDsp);
  const width = tag.width ?? 300;
  const height = tag.height ?? 250;

  switch (variant) {
    case 'vast-url':
      return vastUrl;
    case 'vast-xml':
      return `<VAST xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n  <Ad id="${tag.id}">\n    <Wrapper>\n      <AdSystem>SMX Studio</AdSystem>\n      <VASTAdTagURI><![CDATA[${vastUrl}]]></VASTAdTagURI>\n    </Wrapper>\n  </Ad>\n</VAST>`;
    case 'display-iframe':
      return `<iframe\n  src="${displayHtmlUrl}"\n  width="${width}"\n  height="${height}"\n  scrolling="no"\n  frameborder="0"\n  marginwidth="0"\n  marginheight="0"\n  style="border:0;overflow:hidden;"\n></iframe>`;
    case 'display-ins':
      return `<ins id="smx-ad-slot-${tag.id}" style="display:inline-block;width:${width}px;height:${height}px;"></ins>\n<script>\n  (function(slot) {\n    if (!slot) return;\n    var iframe = document.createElement('iframe');\n    iframe.src = ${JSON.stringify(displayHtmlUrl)};\n    iframe.width = ${JSON.stringify(String(width))};\n    iframe.height = ${JSON.stringify(String(height))};\n    iframe.scrolling = 'no';\n    iframe.frameBorder = '0';\n    iframe.style.border = '0';\n    iframe.style.overflow = 'hidden';\n    slot.replaceWith(iframe);\n  })(document.getElementById(${JSON.stringify(`smx-ad-slot-${tag.id}`)}));\n</script>`;
    case 'native-js':
      return `<script>\n  window.SMX = window.SMX || {};\n  window.SMX.native = window.SMX.native || [];\n  window.SMX.native.push({ tagId: "${tag.id}", format: "native" });\n</script>\n<script src="${nativeJsUrl}" async></script>`;
    case 'tracker-impression':
      return trackerImpressionUrl;
    case 'tracker-click':
      return trackerClickUrl;
    case 'display-js':
    default:
      return `<script src="${displayJsUrl}" async></script>\n<noscript>\n  <iframe src="${displayHtmlUrl}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="border:0;overflow:hidden;"></iframe>\n</noscript>`;
  }
}

function getSnippetHelpText(tag: SavedTag, variant: SnippetVariant, campaignDsp = ''): string {
  const selectedConfig = getDspMacroConfig(campaignDsp);
  const dspNote = selectedConfig
    ? ` ${selectedConfig.label} macros are auto-injected for delivery context and click passthrough.`
    : '';
  if (tag.format === 'VAST') {
    return variant === 'vast-url'
      ? `Use this VAST tag URL in a video player, SSP, or DSP that expects VAST XML.${dspNote}`
      : `Use this XML wrapper only if your integration explicitly requires inline VAST XML.${dspNote}`;
  }
  if (tag.format === 'display') {
    if (variant === 'display-iframe') {
      return `Use the iframe tag for sandboxed display placements or when a publisher requests iframe delivery.${dspNote}`;
    }
    if (variant === 'display-ins') {
      return `Use the ins tag when the publisher expects a slot placeholder plus inline bootstrap code.${dspNote}`;
    }
    return `Use the JavaScript tag for standard display placements. This is not a VAST tag.${dspNote}`;
  }
  if (tag.format === 'tracker') {
    return variant === 'tracker-impression'
      ? `Use this 1x1 GIF URL as a pure impression tracker in external platforms.${dspNote}`
      : `Use this click tracker URL in Meta or other platforms when you only need click measurement.${dspNote}`;
  }
  return `Use the JavaScript tag to initialize the native placement loader.${dspNote}`;
}

function getDisplaySizePreset(width?: string, height?: string): string {
  const normalized = `${Number(width) || 0}x${Number(height) || 0}`;
  return DISPLAY_SIZE_PRESETS.some((preset) => preset.label === normalized) ? normalized : '';
}

export default function TagBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id && id !== 'new');

  const [form, setForm] = useState<TagForm>(emptyForm);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof TagForm, string>>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [savedTag, setSavedTag] = useState<SavedTag | null>(null);
  const [snippetVariant, setSnippetVariant] = useState<SnippetVariant>(getDefaultSnippetVariant(emptyForm.format, emptyForm.trackerType));
  const [copied, setCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [bindings, setBindings] = useState<TagBinding[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [creativeOptions, setCreativeOptions] = useState<CreativeAssignmentOption[]>([]);
  const [creativeOptionsLoading, setCreativeOptionsLoading] = useState(false);
  const [assignmentVersionId, setAssignmentVersionId] = useState('');
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const selectedCampaignDsp = readCampaignDsp(campaigns.find((campaign) => campaign.id === form.campaignId)?.metadata ?? null);
  const selectedCampaignMacroConfig = getDspMacroConfig(selectedCampaignDsp);

  useEffect(() => {
    fetch('/v1/campaigns', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCampaigns(d?.campaigns ?? d ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fetch(`/v1/tags/${id}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then(payload => {
        const data = (payload?.tag ?? payload) as Record<string, unknown>;
        setForm({
          name: String(data.name ?? ''),
          campaignId: String((data.campaign as { id?: string } | undefined)?.id ?? data.campaignId ?? ''),
          format: (data.format as TagFormat | undefined) ?? 'VAST',
          status: (data.status as TagStatus | undefined) ?? 'draft',
          clickUrl: String(data.clickUrl ?? ''),
          servingWidth: String(data.servingWidth ?? data.width ?? ''),
          servingHeight: String(data.servingHeight ?? data.height ?? ''),
          trackerType: data.trackerType === 'impression' ? 'impression' : 'click',
        });
        const normalized = normalizeTagRecord(payload);
        setSavedTag(normalized);
        setSnippetVariant(getDefaultSnippetVariant(((data.format as TagFormat | undefined) ?? 'VAST'), data.trackerType === 'impression' ? 'impression' : data.trackerType === 'click' ? 'click' : null));
        setSuccessMessage('');
      })
      .catch(() => setGeneralError('Failed to load tag.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit || !id) return;
    setBindingsLoading(true);
    setAssignmentError('');
    void loadTagBindings(id)
      .then(nextBindings => setBindings(nextBindings))
      .catch(() => setAssignmentError('Failed to load assigned creatives.'))
      .finally(() => setBindingsLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    setCreativeOptionsLoading(true);
    void loadCreativesWithLatestVersion()
      .then(({ creatives, latestVersions }) => {
        const nextOptions = creatives
          .map(creative => {
            const latestVersion = latestVersions[creative.id];
            return latestVersion ? { creative, latestVersion } : null;
          })
          .filter((entry): entry is CreativeAssignmentOption => Boolean(entry))
          .sort((left, right) => left.creative.name.localeCompare(right.creative.name));
        setCreativeOptions(nextOptions);
        setAssignmentVersionId(current => current || nextOptions[0]?.latestVersion.id || '');
      })
      .catch(() => setAssignmentError('Failed to load available creatives.'))
      .finally(() => setCreativeOptionsLoading(false));
  }, [isEdit]);

  const set = (field: keyof TagForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
    if (field !== 'name') setSuccessMessage('');
  };

  const setFormat = (f: TagFormat) => {
    if (isEdit) return;
    setForm(prev => ({
      ...prev,
      format: f,
      servingWidth: f === 'display' ? prev.servingWidth : '',
      servingHeight: f === 'display' ? prev.servingHeight : '',
      trackerType: f === 'tracker' ? prev.trackerType : 'click',
    }));
    setSnippetVariant(getDefaultSnippetVariant(f, f === 'tracker' ? form.trackerType : null));
    setErrors(er => ({ ...er, format: undefined }));
    setSuccessMessage('');
  };

  const handleDisplaySizePresetChange = (value: string) => {
    const preset = DISPLAY_SIZE_PRESETS.find((entry) => entry.label === value);
    if (!preset) return;
    setForm(prev => ({
      ...prev,
      servingWidth: String(preset.width),
      servingHeight: String(preset.height),
    }));
    setErrors(er => ({ ...er, servingWidth: undefined, servingHeight: undefined }));
    setSuccessMessage('');
  };

  const validate = () => {
    const errs: Partial<Record<keyof TagForm, string>> = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (form.format === 'display') {
      const width = Number(form.servingWidth);
      const height = Number(form.servingHeight);
      if (!Number.isFinite(width) || width <= 0) errs.servingWidth = 'Width is required for display tags.';
      if (!Number.isFinite(height) || height <= 0) errs.servingHeight = 'Height is required for display tags.';
    }
    if (form.format === 'tracker' && form.trackerType === 'click' && !form.clickUrl.trim()) {
      errs.clickUrl = 'Click URL is required for click trackers.';
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
      campaignId: form.campaignId || null,
      format: form.format,
      status: form.status,
      clickUrl: form.clickUrl.trim() || null,
      servingWidth: form.format === 'display' ? Number(form.servingWidth) || null : null,
      servingHeight: form.format === 'display' ? Number(form.servingHeight) || null : null,
      trackerType: form.format === 'tracker' ? form.trackerType : null,
    };

    try {
      const url = isEdit ? `/v1/tags/${id}` : '/v1/tags';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const payload = await res.json();
        const normalized = normalizeTagRecord(payload);
        setSavedTag(normalized);
        setSnippetVariant(getDefaultSnippetVariant(normalized?.format ?? form.format, normalized?.trackerType ?? null));
        setSuccessMessage(isEdit ? 'Tag updated successfully.' : 'Tag created successfully.');
      } else {
        const data = await res.json().catch(() => ({}));
        setGeneralError(data?.message ?? 'Failed to save tag.');
      }
    } catch {
      setGeneralError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!savedTag) return;
    navigator.clipboard.writeText(buildTagSnippet(savedTag, snippetVariant, selectedCampaignDsp)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const refreshBindings = async () => {
    if (!id) return;
    const nextBindings = await loadTagBindings(id);
    setBindings(nextBindings);
  };

  const handleAssignCreative = async () => {
    if (!id || !assignmentVersionId) {
      setAssignmentError('Select a creative to assign.');
      return;
    }

    setAssignmentBusy(true);
    setAssignmentError('');

    try {
      await assignCreativeVersionToTag({
        creativeVersionId: assignmentVersionId,
        tagId: id,
      });
      await refreshBindings();
      const selectedOption = creativeOptions.find(option => option.latestVersion.id === assignmentVersionId);
      setSuccessMessage(
        selectedOption
          ? `Creative "${selectedOption.creative.name}" assigned successfully.`
          : 'Creative assigned successfully.',
      );
    } catch (error: any) {
      setAssignmentError(error?.message ?? 'Failed to assign creative.');
    } finally {
      setAssignmentBusy(false);
    }
  };

  const inputClass = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
      err ? 'border-red-400 bg-red-50' : 'border-slate-300'
    }`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Edit Tag' : 'New Tag'}</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        {generalError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {generalError}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tag Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              className={inputClass(errors.name)}
              placeholder="Homepage Leaderboard VAST"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Campaign */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Campaign</label>
            <select value={form.campaignId} onChange={set('campaignId')} className={inputClass()}>
              <option value="">— No campaign —</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {selectedCampaignMacroConfig && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
              {selectedCampaignMacroConfig.label} selected on this campaign. Generated tag URLs will auto-inject configured DSP macros like <code>{'{pageUrlEnc}'}</code>, <code>{'{domain}'}</code>, click macro passthrough, privacy strings, and identity hints where applicable.
            </div>
          )}

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
            <div className="flex gap-3">
              {(['VAST', 'display', 'native', 'tracker'] as TagFormat[]).map(f => (
                <label
                  key={f}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    form.format === f
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={form.format === f}
                    onChange={() => setFormat(f)}
                    disabled={isEdit}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium capitalize">{f}</span>
                </label>
              ))}
            </div>
            {isEdit && (
              <p className="mt-2 text-xs text-slate-500">
                Format is locked after a tag is created. Display tags remain display, and VAST tags remain VAST.
              </p>
            )}
          </div>

          {form.format === 'display' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Size Preset <span className="text-red-500">*</span>
                </label>
                <select
                  value={getDisplaySizePreset(form.servingWidth, form.servingHeight)}
                  onChange={event => handleDisplaySizePresetChange(event.target.value)}
                  className={inputClass(errors.servingWidth || errors.servingHeight)}
                >
                  <option value="">Select a size</option>
                  {DISPLAY_SIZE_PRESETS.map((preset) => (
                    <option key={preset.label} value={preset.label}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                {(errors.servingWidth || errors.servingHeight) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.servingWidth ?? errors.servingHeight}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
                <input
                  type="number"
                  min="1"
                  readOnly
                  value={form.servingWidth}
                  className={`${inputClass()} bg-slate-50 text-slate-500`}
                  placeholder="300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                <input
                  type="number"
                  min="1"
                  readOnly
                  value={form.servingHeight}
                  className={`${inputClass()} bg-slate-50 text-slate-500`}
                  placeholder="250"
                />
              </div>
            </div>
          )}

          {form.format === 'tracker' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tracker Type</label>
                <select value={form.trackerType} onChange={set('trackerType')} className={inputClass()}>
                  <option value="click">Click tracker</option>
                  <option value="impression">Impression tracker</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tracker Size</label>
                <input
                  type="text"
                  readOnly
                  value={form.trackerType === 'impression' ? '1x1' : 'N/A'}
                  className={`${inputClass()} bg-slate-50 text-slate-500`}
                />
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={set('status')} className={inputClass()}>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" open={form.format === 'tracker'}>
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              {form.format === 'tracker' ? 'Tracker Destination' : 'Click Override'}
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              {form.format === 'tracker'
                ? 'Click trackers need a destination URL. Impression trackers ignore this field and only return a 1x1 measurement pixel.'
                : <>HTML5 banners keep their own <code>clickTag</code> or <code>exit</code> by default. Set this only when the ad server must override that destination.</>}
            </p>
            <div className="mt-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {form.format === 'tracker' ? 'Destination URL' : 'Click URL Override (optional)'}
              </label>
              <input
                type="url"
                value={form.clickUrl}
                onChange={set('clickUrl')}
                className={inputClass(errors.clickUrl)}
                placeholder="https://example.com/landing"
              />
              {errors.clickUrl && <p className="mt-1 text-xs text-red-600">{errors.clickUrl}</p>}
            </div>
          </details>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/tags')}
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
              {saving ? 'Saving...' : isEdit ? 'Update Tag' : 'Create Tag'}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Snippet */}
      {savedTag && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">Generated Tag Snippet</h2>
            <button
              onClick={handleCopy}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {getSnippetOptions(savedTag.format, savedTag.trackerType ?? null).map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSnippetVariant(option.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  snippetVariant === option.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-3">
            {getSnippetHelpText(savedTag, snippetVariant, selectedCampaignDsp)}
          </p>
          <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
            {buildTagSnippet(savedTag, snippetVariant, selectedCampaignDsp)}
          </pre>
        </div>
      )}

      {isEdit && savedTag && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col gap-1 mb-5">
            <h2 className="text-base font-semibold text-slate-800">Creative Assignments</h2>
            <p className="text-sm text-slate-500">
              Assign creatives directly from this tag. For display tags, only compatible sizes can be attached.
            </p>
          </div>

          {assignmentError && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {assignmentError}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold text-slate-800">Assigned Creatives</h3>
                {bindingsLoading && <span className="text-xs text-slate-500">Loading…</span>}
              </div>

              {bindings.length === 0 && !bindingsLoading ? (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  No creatives assigned yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {bindings.map(binding => (
                    <div key={binding.id} className="rounded-lg border border-slate-200 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{binding.creativeName}</p>
                          <p className="text-xs text-slate-500">
                            {binding.variantLabel
                              ? `${binding.variantLabel} • ${binding.variantWidth ?? '?'}x${binding.variantHeight ?? '?'}`
                              : binding.servingFormat}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {binding.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Assign Creative</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Creative</label>
                  <select
                    value={assignmentVersionId}
                    onChange={event => {
                      setAssignmentVersionId(event.target.value);
                      setAssignmentError('');
                      setSuccessMessage('');
                    }}
                    className={inputClass()}
                    disabled={creativeOptionsLoading || assignmentBusy}
                  >
                    <option value="">Select a creative</option>
                    {creativeOptions.map(option => (
                      <option key={option.latestVersion.id} value={option.latestVersion.id}>
                        {option.creative.name} · v{option.latestVersion.versionNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAssignCreative}
                  disabled={assignmentBusy || creativeOptionsLoading || !assignmentVersionId}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition-colors"
                >
                  {assignmentBusy ? 'Assigning…' : 'Assign Creative'}
                </button>

                <p className="text-xs text-slate-500">
                  This uses the latest published version available for the selected creative and respects format and size constraints on the API side.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string;
}

type TagFormat = 'VAST' | 'display' | 'native';
type TagStatus = 'draft' | 'active' | 'paused' | 'archived';

interface TagForm {
  name: string;
  campaignId: string;
  format: TagFormat;
  status: TagStatus;
}

interface SavedTag {
  id: string;
  format: TagFormat;
  name: string;
  width?: number | null;
  height?: number | null;
}

type SnippetVariant =
  | 'vast-url'
  | 'vast-xml'
  | 'display-js'
  | 'display-iframe'
  | 'display-ins'
  | 'native-js';

const emptyForm: TagForm = {
  name: '',
  campaignId: '',
  format: 'VAST',
  status: 'draft',
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

function getDefaultSnippetVariant(format: TagFormat): SnippetVariant {
  if (format === 'VAST') return 'vast-url';
  if (format === 'display') return 'display-js';
  return 'native-js';
}

function getSnippetOptions(format: TagFormat): Array<{ value: SnippetVariant; label: string }> {
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
  return [{ value: 'native-js', label: 'JS Tag' }];
}

function normalizeTagRecord(payload: unknown): SavedTag | null {
  const source = (payload as { tag?: Record<string, unknown> } | null)?.tag
    ?? (payload as Record<string, unknown> | null);
  if (!source || typeof source !== 'object') return null;

  const format = source.format === 'display' || source.format === 'native' || source.format === 'VAST'
    ? source.format
    : 'display';
  const creatives = Array.isArray(source.creatives) ? source.creatives : [];
  const firstCreative = creatives[0] as Record<string, unknown> | undefined;

  return {
    id: String(source.id ?? ''),
    format,
    name: String(source.name ?? ''),
    width: Number(firstCreative?.width ?? 0) || null,
    height: Number(firstCreative?.height ?? 0) || null,
  };
}

function buildTagSnippet(tag: SavedTag, variant: SnippetVariant): string {
  const servingBaseUrl = resolveTagServingBaseUrl();
  const displayJsUrl = `${servingBaseUrl}/v1/tags/display/${tag.id}.js`;
  const displayHtmlUrl = `${servingBaseUrl}/v1/tags/display/${tag.id}.html`;
  const nativeJsUrl = `${servingBaseUrl}/v1/tags/native/${tag.id}.js`;
  const vastUrl = `${servingBaseUrl}/v1/vast/tags/${tag.id}`;
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
    case 'display-js':
    default:
      return `<script src="${displayJsUrl}" async></script>\n<noscript>\n  <iframe src="${displayHtmlUrl}" width="${width}" height="${height}" scrolling="no" frameborder="0" style="border:0;overflow:hidden;"></iframe>\n</noscript>`;
  }
}

function getSnippetHelpText(tag: SavedTag, variant: SnippetVariant): string {
  if (tag.format === 'VAST') {
    return variant === 'vast-url'
      ? 'Use this VAST tag URL in a video player, SSP, or DSP that expects VAST XML.'
      : 'Use this XML wrapper only if your integration explicitly requires inline VAST XML.';
  }
  if (tag.format === 'display') {
    if (variant === 'display-iframe') {
      return 'Use the iframe tag for sandboxed display placements or when a publisher requests iframe delivery.';
    }
    if (variant === 'display-ins') {
      return 'Use the ins tag when the publisher expects a slot placeholder plus inline bootstrap code.';
    }
    return 'Use the JavaScript tag for standard display placements. This is not a VAST tag.';
  }
  return 'Use the JavaScript tag to initialize the native placement loader.';
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
  const [snippetVariant, setSnippetVariant] = useState<SnippetVariant>(getDefaultSnippetVariant(emptyForm.format));
  const [copied, setCopied] = useState(false);

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
        });
        const normalized = normalizeTagRecord(payload);
        setSavedTag(normalized);
        setSnippetVariant(getDefaultSnippetVariant(((data.format as TagFormat | undefined) ?? 'VAST')));
      })
      .catch(() => setGeneralError('Failed to load tag.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (field: keyof TagForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const setFormat = (f: TagFormat) => {
    setForm(prev => ({ ...prev, format: f }));
    setSnippetVariant(getDefaultSnippetVariant(f));
    setErrors(er => ({ ...er, format: undefined }));
  };

  const validate = () => {
    const errs: Partial<Record<keyof TagForm, string>> = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
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
        setSnippetVariant(getDefaultSnippetVariant(normalized?.format ?? form.format));
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
    navigator.clipboard.writeText(buildTagSnippet(savedTag, snippetVariant)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
            <div className="flex gap-3">
              {(['VAST', 'display', 'native'] as TagFormat[]).map(f => (
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
                    className="sr-only"
                  />
                  <span className="text-sm font-medium capitalize">{f}</span>
                </label>
              ))}
            </div>
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
            {getSnippetOptions(savedTag.format).map(option => (
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
            {getSnippetHelpText(savedTag, snippetVariant)}
          </p>
          <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
            {buildTagSnippet(savedTag, snippetVariant)}
          </pre>
        </div>
      )}
    </div>
  );
}

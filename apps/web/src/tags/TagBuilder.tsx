import React, { useEffect, useState, FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  getDspMacroConfig,
  readCampaignDsp,
  shouldUseDspVideoDelivery,
} from '@smx/contracts/dsp-macros';
import TagFormPanel from './TagFormPanel';
import TagDiagnosticsPanel from './TagDiagnosticsPanel';
import TagSnippetPanel from './TagSnippetPanel';
import TagBindingsPanel from './TagBindingsPanel';
import {
  emptyForm,
  normalizeTagRecord,
  type Campaign,
  type DeliveryDiagnosticsPayload,
  type SavedTag,
  type TagForm,
  type TagFormat,
  type TagStatus,
} from './tag-builder-shared';
import { Button, CenteredSpinner, Kicker } from '../system';

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
  const [copiedStaticProfile, setCopiedStaticProfile] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [deliveryDiagnostics, setDeliveryDiagnostics] = useState<DeliveryDiagnosticsPayload | null>(null);
  const [deliveryDiagnosticsLoading, setDeliveryDiagnosticsLoading] = useState(false);
  const [republishingStaticDelivery, setRepublishingStaticDelivery] = useState(false);
  const [queueingStaticDelivery, setQueueingStaticDelivery] = useState(false);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === form.campaignId) ?? null;
  const selectedCampaignWorkspaceId = selectedCampaign?.workspaceId ?? selectedCampaign?.workspace_id ?? null;
  const selectedCampaignDsp = readCampaignDsp(
    selectedCampaign?.metadata ?? savedTag?.campaign?.metadata ?? null,
  );
  const selectedCampaignMediaType = String(selectedCampaign?.metadata?.mediaType ?? 'display').toLowerCase();
  const videoCampaign = selectedCampaignMediaType === 'video';
  const selectedCampaignMacroConfig = getDspMacroConfig(selectedCampaignDsp);
  const basisNativeEnabled = deliveryDiagnostics?.deliverySummary?.basisNativeActive ?? false;
  const dspVideoEnabled = deliveryDiagnostics?.deliverySummary?.deliveryMode === 'dsp_video_contract'
    || Boolean(savedTag && savedTag.format === 'VAST' && shouldUseDspVideoDelivery(selectedCampaignDsp));
  const basisDiagnosticPath = deliveryDiagnostics?.deliveryDiagnostics?.displayWrapper?.policy?.measurementPath
    ?? deliveryDiagnostics?.deliveryDiagnostics?.trackerClick?.policy?.measurementPath
    ?? '';
  const basisFallbackActive = (deliveryDiagnostics?.deliverySummary?.previewStatus ?? basisDiagnosticPath).toLowerCase().includes('fallback');
  const staticDeliveryEntries = deliveryDiagnostics?.deliveryDiagnostics?.vast?.staticProfiles
    ? [
        {
          key: 'default',
          label: 'Default',
          url: deliveryDiagnostics.deliveryDiagnostics.vast.staticProfiles.default,
          status: deliveryDiagnostics.deliveryDiagnostics.vast.staticProfileStatus?.default,
        },
        {
          key: 'basis',
          label: 'Basis',
          url: deliveryDiagnostics.deliveryDiagnostics.vast.staticProfiles.basis,
          status: deliveryDiagnostics.deliveryDiagnostics.vast.staticProfileStatus?.basis,
        },
        {
          key: 'illumin',
          label: 'Illumin',
          url: deliveryDiagnostics.deliveryDiagnostics.vast.staticProfiles.illumin,
          status: deliveryDiagnostics.deliveryDiagnostics.vast.staticProfileStatus?.illumin,
        },
      ].filter((entry) => entry.url)
    : [];

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
      .then((tagPayload) => {
        const data = (tagPayload?.tag ?? tagPayload) as Record<string, unknown>;
        const trackerType = data.trackerType === 'impression' ? 'impression' : 'click';
        const format = (data.format as TagFormat | undefined) ?? 'VAST';

        setForm({
          name: String(data.name ?? ''),
          campaignId: String((data.campaign as { id?: string } | undefined)?.id ?? data.campaignId ?? ''),
          format,
          status: (data.status as TagStatus | undefined) ?? 'draft',
          clickUrl: format === 'tracker' && trackerType === 'click'
            ? String(data.clickUrl ?? '').trim()
            : '',
          servingWidth: String(data.servingWidth ?? data.width ?? ''),
          servingHeight: String(data.servingHeight ?? data.height ?? ''),
          trackerType,
        });
        const normalized = normalizeTagRecord(tagPayload);
        setSavedTag(normalized);
        setSuccessMessage('');
      })
      .catch(() => setGeneralError('Failed to load tag.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit || !id) return;
    void refreshDeliveryDiagnostics();
  }, [id, isEdit]);

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
    setErrors(er => ({ ...er, format: undefined }));
    setSuccessMessage('');
  };

  useEffect(() => {
    if (isEdit) return;
    if (!videoCampaign) return;
    if (form.format === 'VAST') return;
    setForm(prev => ({
      ...prev,
      format: 'VAST',
      servingWidth: '',
      servingHeight: '',
      trackerType: 'click',
    }));
    setErrors(er => ({ ...er, format: undefined }));
  }, [videoCampaign, form.format, isEdit]);

  useEffect(() => {
    if (form.format === 'tracker' && form.trackerType === 'click') return;
    if (!form.clickUrl) return;
    setForm((prev) => ({ ...prev, clickUrl: '' }));
  }, [form.format, form.trackerType, form.clickUrl]);

  const handleDisplaySizePresetChange = (value: string) => {
    const preset = [
      { label: '300x250', width: 300, height: 250 },
      { label: '320x50', width: 320, height: 50 },
      { label: '320x100', width: 320, height: 100 },
      { label: '336x280', width: 336, height: 280 },
      { label: '728x90', width: 728, height: 90 },
      { label: '970x250', width: 970, height: 250 },
      { label: '160x600', width: 160, height: 600 },
      { label: '300x600', width: 300, height: 600 },
    ].find((entry) => entry.label === value);
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
      clickUrl: form.format === 'tracker' && form.trackerType === 'click' ? form.clickUrl.trim() || null : null,
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

  const handleCopyStaticProfile = (profileKey: string, url?: string | null) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedStaticProfile(profileKey);
      setTimeout(() => {
        setCopiedStaticProfile((current) => (current === profileKey ? null : current));
      }, 2000);
    });
  };

  const handleDownloadStaticProfile = (profileKey: string, url?: string | null) => {
    if (!savedTag || !url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${savedTag.id}-${profileKey}.xml`;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllStaticProfiles = () => {
    staticDeliveryEntries.forEach((entry, index) => {
      window.setTimeout(() => {
        handleDownloadStaticProfile(entry.key, entry.url);
      }, index * 150);
    });
  };

  const refreshDeliveryDiagnostics = async () => {
    if (!id) return;
    setDeliveryDiagnosticsLoading(true);
    try {
      const response = await fetch(`/v1/tags/${id}/delivery-diagnostics`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to load diagnostics');
      const payload = await response.json();
      setDeliveryDiagnostics(payload as DeliveryDiagnosticsPayload);
    } catch {
      setDeliveryDiagnostics(null);
    } finally {
      setDeliveryDiagnosticsLoading(false);
    }
  };

  const handleRepublishStaticDelivery = async () => {
    if (!id) return;
    setRepublishingStaticDelivery(true);
    setGeneralError('');
    setSuccessMessage('');

    try {
      const profiles = [
        { dsp: '', label: 'Default' },
        { dsp: 'Basis', label: 'Basis' },
        { dsp: 'Illumin', label: 'Illumin' },
      ];
      for (const profile of profiles) {
        const response = await fetch(`/v1/vast/tags/${id}/publish-static`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ dsp: profile.dsp }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.message ?? `Failed to publish static ${profile.label} delivery.`);
        }
      }
      await refreshDeliveryDiagnostics();
      setSuccessMessage('Static VAST delivery republished successfully.');
    } catch (error: any) {
      setGeneralError(error?.message ?? 'Failed to republish static VAST delivery.');
    } finally {
      setRepublishingStaticDelivery(false);
    }
  };

  const handleQueueStaticDelivery = async () => {
    if (!id) return;
    setQueueingStaticDelivery(true);
    setGeneralError('');
    setSuccessMessage('');

    try {
      const response = await fetch(`/v1/vast/tags/${id}/queue-static-publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Failed to queue static VAST delivery publish.');
      }
      await refreshDeliveryDiagnostics();
      setSuccessMessage('Static VAST delivery queued successfully.');
    } catch (error: any) {
      setGeneralError(error?.message ?? 'Failed to queue static VAST delivery publish.');
    } finally {
      setQueueingStaticDelivery(false);
    }
  };

  if (loading) {
    return <CenteredSpinner label="Loading tag builder…" />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Kicker>Tags</Kicker>
          <h1 className="mt-3 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{isEdit ? 'Edit Tag' : 'New Tag'}</h1>
        </div>
        {isEdit && id ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/tags/${id}/reporting`}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 py-2 text-sm font-medium text-[color:var(--dusk-text-secondary)] transition-colors hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] hover:text-[color:var(--dusk-text-primary)]"
            >
              Reporting
            </Link>
            <Link
              to={`/tags/${id}/tracking`}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 py-2 text-sm font-medium text-[color:var(--dusk-text-secondary)] transition-colors hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] hover:text-[color:var(--dusk-text-primary)]"
            >
              Tracking
            </Link>
            <Link
              to={`/tags/${id}/pixels`}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 py-2 text-sm font-medium text-[color:var(--dusk-text-secondary)] transition-colors hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] hover:text-[color:var(--dusk-text-primary)]"
            >
              Pixels
            </Link>
          </div>
        ) : null}
      </div>

      <TagFormPanel
        isEdit={isEdit}
        form={form}
        campaigns={campaigns}
        errors={errors}
        saving={saving}
        successMessage={successMessage}
        generalError={generalError}
        selectedCampaignMacroLabel={selectedCampaignMacroConfig?.label ?? null}
        videoCampaign={videoCampaign}
        onSet={set}
        onSetFormat={setFormat}
        onDisplaySizePresetChange={handleDisplaySizePresetChange}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/tags')}
      />

      {savedTag && (
        <TagSnippetPanel
          tag={savedTag}
          campaignDsp={selectedCampaignDsp}
          diagnostics={deliveryDiagnostics}
        />
      )}

      {isEdit && savedTag && (
        <TagBindingsPanel
          tagId={id!}
          savedTag={savedTag}
          campaignDsp={selectedCampaignDsp}
          selectedCampaignWorkspaceId={selectedCampaignWorkspaceId}
          tagFormat={savedTag.format}
          tagWidth={Number(form.servingWidth) || savedTag.width || 0}
          tagHeight={Number(form.servingHeight) || savedTag.height || 0}
          onSuccess={(message) => {
            setSuccessMessage(message);
            void refreshDeliveryDiagnostics();
          }}
          onError={(message) => setGeneralError(message)}
        />
      )}

      {isEdit && savedTag && (
        <TagDiagnosticsPanel
          savedTag={savedTag}
          selectedCampaignDsp={selectedCampaignDsp}
          deliveryDiagnostics={deliveryDiagnostics}
          deliveryDiagnosticsLoading={deliveryDiagnosticsLoading}
          basisNativeEnabled={basisNativeEnabled}
          dspVideoEnabled={dspVideoEnabled}
          basisFallbackActive={basisFallbackActive}
          basisDiagnosticPath={basisDiagnosticPath}
          staticDeliveryEntries={staticDeliveryEntries}
          copiedStaticProfile={copiedStaticProfile}
          queueingStaticDelivery={queueingStaticDelivery}
          republishingStaticDelivery={republishingStaticDelivery}
          onCopyStaticProfile={handleCopyStaticProfile}
          onDownloadStaticProfile={handleDownloadStaticProfile}
          onDownloadAllStaticProfiles={handleDownloadAllStaticProfiles}
          onQueueStaticDelivery={() => { void handleQueueStaticDelivery(); }}
          onRepublishStaticDelivery={() => { void handleRepublishStaticDelivery(); }}
        />
      )}
    </div>
  );
}

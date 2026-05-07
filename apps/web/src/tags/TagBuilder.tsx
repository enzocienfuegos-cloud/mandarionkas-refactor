import React, { useEffect, useState, FormEvent } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import {
  Badge,
  Button,
  CenteredSpinner,
  EmptyState,
  FormField,
  Input,
  Kicker,
  PageHeader,
  Panel,
  ReadOnlyValue,
  Select,
  Stepper,
  type Step,
} from '../system';
import { ArrowLeft, ArrowRight, CheckCircle2, FileCode, Shield, Sparkles, Tag as TagIcon, Wrench } from '../system/icons';

type TagWorkflowStepId =
  | 'campaign'
  | 'format'
  | 'creative'
  | 'macros'
  | 'qa'
  | 'snippet'
  | 'publish';

const TAG_WORKFLOW_ORDER: TagWorkflowStepId[] = [
  'campaign',
  'format',
  'creative',
  'macros',
  'qa',
  'snippet',
  'publish',
];

function getStepIndex(step: TagWorkflowStepId) {
  return TAG_WORKFLOW_ORDER.indexOf(step);
}

function isTagWorkflowStep(value: string | null): value is TagWorkflowStepId {
  return Boolean(value && TAG_WORKFLOW_ORDER.includes(value as TagWorkflowStepId));
}

function nextStep(step: TagWorkflowStepId) {
  return TAG_WORKFLOW_ORDER[Math.min(getStepIndex(step) + 1, TAG_WORKFLOW_ORDER.length - 1)];
}

function previousStep(step: TagWorkflowStepId) {
  return TAG_WORKFLOW_ORDER[Math.max(getStepIndex(step) - 1, 0)];
}

export default function TagBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const workflowMode = !isEdit || searchParams.get('workflow') === 'guided';
  const requestedStep = searchParams.get('step');
  const currentStep: TagWorkflowStepId = isTagWorkflowStep(requestedStep)
    ? requestedStep
    : isEdit
      ? 'creative'
      : 'campaign';

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

  const setWorkflowStep = (step: TagWorkflowStepId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', step);
    if (workflowMode) nextParams.set('workflow', 'guided');
    setSearchParams(nextParams, { replace: true });
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

  const validateStep = (step: TagWorkflowStepId) => {
    const nextErrors = validate();
    const scopedErrors: Partial<Record<keyof TagForm, string>> = {};

    if (step === 'campaign') {
      if (nextErrors.name) scopedErrors.name = nextErrors.name;
    }

    if (step === 'format') {
      if (nextErrors.servingWidth) scopedErrors.servingWidth = nextErrors.servingWidth;
      if (nextErrors.servingHeight) scopedErrors.servingHeight = nextErrors.servingHeight;
      if (nextErrors.clickUrl) scopedErrors.clickUrl = nextErrors.clickUrl;
    }

    setErrors((current) => ({ ...current, ...scopedErrors }));
    return Object.keys(scopedErrors).length === 0;
  };

  const saveTag = async (overrides: Partial<TagForm> = {}) => {
    setGeneralError('');
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    const nextForm = { ...form, ...overrides };
    const body = {
      name: nextForm.name.trim(),
      campaignId: nextForm.campaignId || null,
      format: nextForm.format,
      status: nextForm.status,
      clickUrl: nextForm.format === 'tracker' && nextForm.trackerType === 'click' ? nextForm.clickUrl.trim() || null : null,
      servingWidth: nextForm.format === 'display' ? Number(nextForm.servingWidth) || null : null,
      servingHeight: nextForm.format === 'display' ? Number(nextForm.servingHeight) || null : null,
      trackerType: nextForm.format === 'tracker' ? nextForm.trackerType : null,
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
        if (Object.keys(overrides).length > 0) {
          setForm((current) => ({ ...current, ...overrides }));
        }
        setSuccessMessage(isEdit ? 'Tag updated successfully.' : 'Tag created successfully.');
        return normalized;
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await saveTag();
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

  const handleDraftAndContinue = async () => {
    const normalized = await saveTag({ status: 'draft' });
    if (!normalized?.id) return;
    navigate(`/tags/${normalized.id}?workflow=guided&step=creative`);
  };

  const handlePublishTag = async () => {
    const normalized = await saveTag({ status: 'active' });
    if (!normalized?.id) return;
    setWorkflowStep('publish');
  };

  const handleWorkflowNext = async () => {
    if (currentStep === 'campaign' || currentStep === 'format') {
      if (!validateStep(currentStep)) return;
    }

    if (currentStep === 'creative' && !savedTag) {
      await handleDraftAndContinue();
      return;
    }

    if (currentStep === 'publish') {
      await handlePublishTag();
      return;
    }

    setWorkflowStep(nextStep(currentStep));
  };

  const tagWorkflowSteps: Step[] = TAG_WORKFLOW_ORDER.map((stepId) => {
    const index = getStepIndex(stepId);
    const activeIndex = getStepIndex(currentStep);
    const requiresSavedTag = ['creative', 'macros', 'qa', 'snippet', 'publish'].includes(stepId);
    const blocked = requiresSavedTag && !savedTag && stepId !== 'creative';

    let status: Step['status'] = 'upcoming';
    if (blocked) status = 'blocked';
    else if (index < activeIndex) status = 'complete';
    else if (index === activeIndex) status = savedTag || !requiresSavedTag ? 'current' : 'warning';

    let badge: Step['badge'];
    if (stepId === 'qa' && savedTag) {
      badge = {
        label: deliveryDiagnosticsLoading ? 'Checking' : 'Ready',
        tone: deliveryDiagnosticsLoading ? 'warning' : 'info',
      };
    } else if (stepId === 'publish' && savedTag) {
      badge = {
        label: form.status === 'active' ? 'Active' : 'Draft',
        tone: form.status === 'active' ? 'success' : 'warning',
      };
    }

    return {
      id: stepId,
      label:
        stepId === 'campaign'
          ? 'Campaign'
          : stepId === 'format'
            ? 'Format'
            : stepId === 'creative'
              ? 'Creative'
              : stepId === 'macros'
                ? 'Macros'
                : stepId === 'qa'
                  ? 'QA'
                  : stepId === 'snippet'
                    ? 'Snippet'
                    : 'Publish',
      description:
        stepId === 'campaign'
          ? 'Scope the tag to the right campaign.'
          : stepId === 'format'
            ? 'Lock delivery mode and size.'
            : stepId === 'creative'
              ? 'Bind the live creative payload.'
              : stepId === 'macros'
                ? 'Verify macro policy and passthrough.'
                : stepId === 'qa'
                  ? 'Run diagnostics before go-live.'
                  : stepId === 'snippet'
                    ? 'Copy the final delivery markup.'
                    : 'Set final status and ship.',
      status,
      badge,
    };
  });

  if (loading) {
    return <CenteredSpinner label="Loading tag builder…" />;
  }

  const workflowActions = isEdit && id ? (
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
  ) : null;

  if (workflowMode) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          kicker="Tags"
          title={isEdit ? 'Tag Delivery Workflow' : 'Generate Tag'}
          meta={isEdit ? `7-step trafficking workflow · Tag ${savedTag?.name ?? id ?? 'draft'}` : '7-step trafficking workflow · Build once, QA before publish'}
          secondaryActions={workflowActions}
          alert={
            generalError ? (
              <span className="text-[color:var(--dusk-status-critical-fg)]">{generalError}</span>
            ) : successMessage ? (
              <span className="text-[color:var(--dusk-status-success-fg)]">{successMessage}</span>
            ) : (
              <span className="text-[color:var(--dusk-text-secondary)]">
                Diagnostic UI first: campaign scope, macro policy, QA and snippet all stay in one guided flow.
              </span>
            )
          }
        />

        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Panel padding="md" className="h-fit">
            <div className="mb-4">
              <Kicker>Stepper</Kicker>
              <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">
                Campaign, delivery contract, QA and snippet all move in order so traffickers can publish with confidence.
              </p>
            </div>
            <Stepper steps={tagWorkflowSteps} onStepClick={(stepId) => setWorkflowStep(stepId as TagWorkflowStepId)} />
          </Panel>

          <div className="space-y-6">
            {currentStep === 'campaign' && (
              <Panel padding="lg" className="space-y-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]">
                    <TagIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">1. Campaign</h2>
                    <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                      Name the tag and anchor it to the campaign that owns billing, workspace and DSP policy.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Tag Name" required error={errors.name}>
                    <Input
                      value={form.name}
                      onChange={set('name')}
                      invalid={Boolean(errors.name)}
                      placeholder="Homepage Leaderboard VAST"
                    />
                  </FormField>
                  <FormField label="Campaign">
                    <Select value={form.campaignId} onChange={set('campaignId')}>
                      <option value="">— No campaign —</option>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                {selectedCampaignMacroConfig?.label ? (
                  <Panel className="border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-info-fg)]">
                    <strong>{selectedCampaignMacroConfig.label}</strong> macro policy will be inherited automatically from the selected campaign.
                  </Panel>
                ) : null}

                <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                  <Button variant="ghost" onClick={() => navigate('/tags')} leadingIcon={<ArrowLeft />}>
                    Back to tags
                  </Button>
                  <Button onClick={() => void handleWorkflowNext()} trailingIcon={<ArrowRight />}>
                    Continue to format
                  </Button>
                </div>
              </Panel>
            )}

            {currentStep === 'format' && (
              <Panel padding="lg" className="space-y-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">2. Format</h2>
                    <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                      Lock the delivery contract now so the generated snippet, QA rules and binding options all match the serving format.
                    </p>
                  </div>
                </div>

                {videoCampaign ? (
                  <Panel className="border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-info-fg)]">
                    This campaign is video-only, so the workflow is pinned to <strong>VAST</strong>.
                  </Panel>
                ) : null}

                <FormField label="Format">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {(videoCampaign ? (['VAST'] as TagFormat[]) : (['VAST', 'display', 'native', 'tracker'] as TagFormat[])).map((format) => (
                      <Button
                        key={format}
                        type="button"
                        onClick={() => setFormat(format)}
                        variant="secondary"
                        className={`h-auto justify-start rounded-xl px-4 py-4 text-left transition-colors ${
                          form.format === format
                            ? 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]'
                            : 'border-[color:var(--dusk-border-default)] bg-surface-1 text-[color:var(--dusk-text-secondary)] hover:border-[color:var(--dusk-border-strong)] hover:bg-[color:var(--dusk-surface-muted)] hover:text-[color:var(--dusk-text-primary)]'
                        }`}
                      >
                        <Badge tone={form.format === format ? 'info' : 'neutral'} size="sm">
                          {format}
                        </Badge>
                        <p className="mt-3 text-sm font-medium capitalize">{format}</p>
                      </Button>
                    ))}
                  </div>
                </FormField>

                {form.format === 'display' && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField label="Display Size Preset" required error={errors.servingWidth ?? errors.servingHeight} className="md:col-span-3">
                      <Select value={`${form.servingWidth || 0}x${form.servingHeight || 0}`.replace(/^0x0$/, '')} onChange={(event) => handleDisplaySizePresetChange(event.target.value)}>
                        <option value="">Select a size</option>
                        {['300x250', '320x50', '320x100', '336x280', '728x90', '970x250', '160x600', '300x600'].map((preset) => (
                          <option key={preset} value={preset}>{preset}</option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Width">
                      <ReadOnlyValue value={form.servingWidth} copyable={false} placeholder="300" />
                    </FormField>
                    <FormField label="Height">
                      <ReadOnlyValue value={form.servingHeight} copyable={false} placeholder="250" />
                    </FormField>
                  </div>
                )}

                {form.format === 'tracker' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Tracker Type">
                      <Select value={form.trackerType} onChange={set('trackerType')}>
                        <option value="click">Click tracker</option>
                        <option value="impression">Impression tracker</option>
                      </Select>
                    </FormField>
                    <FormField label="Destination URL" error={errors.clickUrl}>
                      <Input
                        type="url"
                        value={form.clickUrl}
                        onChange={set('clickUrl')}
                        invalid={Boolean(errors.clickUrl)}
                        placeholder="https://example.com/landing"
                      />
                    </FormField>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                  <Button variant="ghost" onClick={() => setWorkflowStep(previousStep(currentStep))} leadingIcon={<ArrowLeft />}>
                    Back
                  </Button>
                  <Button onClick={() => void handleWorkflowNext()} trailingIcon={<ArrowRight />}>
                    Continue to creative
                  </Button>
                </div>
              </Panel>
            )}

            {currentStep === 'creative' && (
              <>
                {!savedTag ? (
                  <Panel padding="lg" className="space-y-5">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]">
                        <Wrench className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">3. Creative</h2>
                        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                          We need a draft tag record before we can bind creative versions and size-specific assets.
                        </p>
                      </div>
                    </div>
                    <Panel className="border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-warning-fg)]">
                      Save this tag as a draft now. Then the workflow unlocks binding, QA diagnostics, snippet generation and final publish.
                    </Panel>
                    <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                      <Button variant="ghost" onClick={() => setWorkflowStep(previousStep(currentStep))} leadingIcon={<ArrowLeft />}>
                        Back
                      </Button>
                      <Button onClick={() => void handleDraftAndContinue()} loading={saving} trailingIcon={<ArrowRight />}>
                        Create draft and continue
                      </Button>
                    </div>
                  </Panel>
                ) : (
                  <>
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
                    <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                      <Button variant="ghost" onClick={() => setWorkflowStep(previousStep(currentStep))} leadingIcon={<ArrowLeft />}>
                        Back
                      </Button>
                      <Button onClick={() => setWorkflowStep(nextStep(currentStep))} trailingIcon={<ArrowRight />}>
                        Continue to macros
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}

            {currentStep === 'macros' && (
              savedTag ? (
                <Panel padding="lg" className="space-y-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]">
                      <FileCode className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">4. Macros</h2>
                      <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                        Confirm the delivery contract before QA. This is where DSP passthrough, click destination ownership and size assumptions become explicit.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Campaign macro policy">
                      <ReadOnlyValue value={selectedCampaignMacroConfig?.label ?? 'Default delivery policy'} copyable={false} />
                    </FormField>
                    <FormField label="Serving format">
                      <ReadOnlyValue value={savedTag.format} copyable={false} />
                    </FormField>
                    <FormField label="Display size">
                      <ReadOnlyValue value={savedTag.sizeLabel || `${(savedTag.width ?? form.servingWidth) || '—'}x${(savedTag.height ?? form.servingHeight) || '—'}`} copyable={false} />
                    </FormField>
                    <FormField label="Tracker destination">
                      <ReadOnlyValue value={form.format === 'tracker' && form.trackerType === 'click' ? form.clickUrl : 'Managed by creative binding'} copyable={Boolean(form.clickUrl)} />
                    </FormField>
                  </div>
                  <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                    <Button variant="ghost" onClick={() => setWorkflowStep(previousStep(currentStep))} leadingIcon={<ArrowLeft />}>
                      Back
                    </Button>
                    <Button onClick={() => setWorkflowStep(nextStep(currentStep))} trailingIcon={<ArrowRight />}>
                      Continue to QA
                    </Button>
                  </div>
                </Panel>
              ) : (
                <Panel padding="lg">
                  <EmptyState
                    icon={<FileCode />}
                    title="Create the draft first"
                    description="Macro validation unlocks after the tag record exists and can inherit campaign delivery policy."
                  />
                </Panel>
              )
            )}

            {currentStep === 'qa' && (
              savedTag ? (
                <>
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
                  <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                    <Button variant="ghost" onClick={() => setWorkflowStep(previousStep(currentStep))} leadingIcon={<ArrowLeft />}>
                      Back
                    </Button>
                    <Button onClick={() => setWorkflowStep(nextStep(currentStep))} trailingIcon={<ArrowRight />}>
                      Continue to snippet
                    </Button>
                  </div>
                </>
              ) : (
                <Panel padding="lg">
                  <EmptyState
                    icon={<Shield />}
                    title="QA unlocks after creative binding"
                    description="Save the draft and bind a creative version first so diagnostics can validate the real delivery path."
                  />
                </Panel>
              )
            )}

            {currentStep === 'snippet' && (
              savedTag ? (
                <>
                  <TagSnippetPanel
                    tag={savedTag}
                    campaignDsp={selectedCampaignDsp}
                    diagnostics={deliveryDiagnostics}
                  />
                  <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                    <Button variant="ghost" onClick={() => setWorkflowStep(previousStep(currentStep))} leadingIcon={<ArrowLeft />}>
                      Back
                    </Button>
                    <Button onClick={() => setWorkflowStep(nextStep(currentStep))} trailingIcon={<ArrowRight />}>
                      Continue to publish
                    </Button>
                  </div>
                </>
              ) : (
                <Panel padding="lg">
                  <EmptyState
                    icon={<FileCode />}
                    title="Snippet pending"
                    description="Once the draft exists and QA is in place, the final snippet becomes available here for copy and handoff."
                  />
                </Panel>
              )
            )}

            {currentStep === 'publish' && (
              savedTag ? (
                <Panel padding="lg" className="space-y-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">7. Publish</h2>
                      <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                        Final checkpoint. Set the live status and publish only after bindings, macros and diagnostics look clean.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Tag status">
                      <Select value={form.status} onChange={set('status')}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="archived">Archived</option>
                      </Select>
                    </FormField>
                    <FormField label="Tag ID">
                      <ReadOnlyValue value={savedTag.id} />
                    </FormField>
                  </div>
                  <Panel className="border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-info-fg)]">
                    {form.status === 'active'
                      ? 'This tag is already active. Use save to keep the workflow state in sync after any last-minute change.'
                      : 'Publish will move the tag to active status so ops can distribute the snippet with confidence.'}
                  </Panel>
                  <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                    <Button variant="ghost" onClick={() => setWorkflowStep(previousStep(currentStep))} leadingIcon={<ArrowLeft />}>
                      Back
                    </Button>
                    <div className="flex items-center gap-3">
                      <Badge tone={form.status === 'active' ? 'success' : 'warning'}>
                        {form.status === 'active' ? 'Ready to traffic' : 'Still draft'}
                      </Badge>
                      <Button onClick={() => void handlePublishTag()} loading={saving}>
                        {form.status === 'active' ? 'Save workflow' : 'Publish tag'}
                      </Button>
                    </div>
                  </div>
                </Panel>
              ) : (
                <Panel padding="lg">
                  <EmptyState
                    icon={<CheckCircle2 />}
                    title="Publish is locked"
                    description="A publish action only makes sense after the tag exists, has a binding and has passed QA."
                  />
                </Panel>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Kicker>Tags</Kicker>
          <h1 className="mt-3 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{isEdit ? 'Edit Tag' : 'New Tag'}</h1>
        </div>
        {workflowActions}
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

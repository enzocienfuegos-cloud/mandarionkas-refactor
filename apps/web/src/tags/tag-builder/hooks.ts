import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import {
  getDspMacroConfig,
  readCampaignDsp,
  shouldUseDspVideoDelivery,
} from '@smx/contracts/dsp-macros';
import { loadWorkspaces, type WorkspaceOption } from '../../shared/workspaces';
import {
  emptyForm,
  normalizeTagRecord,
  type Campaign,
  type DeliveryDiagnosticsPayload,
  type SavedTag,
  type TagForm,
  type TagFormat,
  type TagStatus,
} from '../tag-builder-shared';
import type { Step } from '../../system';

export type TagWorkflowStepId =
  | 'campaign'
  | 'format'
  | 'creative'
  | 'macros'
  | 'qa'
  | 'snippet'
  | 'publish';

export const TAG_WORKFLOW_ORDER: TagWorkflowStepId[] = [
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

export function nextStep(step: TagWorkflowStepId) {
  return TAG_WORKFLOW_ORDER[Math.min(getStepIndex(step) + 1, TAG_WORKFLOW_ORDER.length - 1)];
}

export function previousStep(step: TagWorkflowStepId) {
  return TAG_WORKFLOW_ORDER[Math.max(getStepIndex(step) - 1, 0)];
}

export function useTagWorkflow({
  isEdit,
  searchParams,
  setSearchParams,
}: {
  isEdit: boolean;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}) {
  const workflowMode = !isEdit || searchParams.get('workflow') === 'guided';
  const requestedStep = searchParams.get('step');
  const currentStep: TagWorkflowStepId = isTagWorkflowStep(requestedStep)
    ? requestedStep
    : isEdit
      ? 'creative'
      : 'campaign';

  const setWorkflowStep = (step: TagWorkflowStepId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', step);
    if (workflowMode) nextParams.set('workflow', 'guided');
    setSearchParams(nextParams, { replace: true });
  };

  return {
    workflowMode,
    currentStep,
    setWorkflowStep,
  };
}

export function buildTagWorkflowSteps({
  currentStep,
  savedTag,
  deliveryDiagnosticsLoading,
  formStatus,
}: {
  currentStep: TagWorkflowStepId;
  savedTag: SavedTag | null;
  deliveryDiagnosticsLoading: boolean;
  formStatus: TagStatus;
}) {
  return TAG_WORKFLOW_ORDER.map((stepId) => {
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
        label: formStatus === 'active' ? 'Active' : 'Draft',
        tone: formStatus === 'active' ? 'success' : 'warning',
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
}

export function useTagBuilderData({
  id,
  isEdit,
}: {
  id?: string;
  isEdit: boolean;
}) {
  const [form, setForm] = useState<TagForm>(emptyForm);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof TagForm, string>>>({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [savedTag, setSavedTag] = useState<SavedTag | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const selectedCampaign = campaigns.find((campaign) => campaign.id === form.campaignId) ?? null;
  const selectedWorkspaceId = form.workspaceId || selectedCampaign?.workspaceId || selectedCampaign?.workspace_id || '';
  const filteredCampaigns = selectedWorkspaceId
    ? campaigns.filter((campaign) => (campaign.workspaceId ?? campaign.workspace_id ?? '') === selectedWorkspaceId)
    : campaigns;
  const selectedCampaignWorkspaceId = selectedCampaign?.workspaceId ?? selectedCampaign?.workspace_id ?? null;
  const selectedCampaignDsp = readCampaignDsp(
    selectedCampaign?.metadata ?? savedTag?.campaign?.metadata ?? null,
  );
  const selectedCampaignMediaType = String(selectedCampaign?.metadata?.mediaType ?? 'display').toLowerCase();
  const videoCampaign = selectedCampaignMediaType === 'video';
  const selectedCampaignMacroConfig = getDspMacroConfig(selectedCampaignDsp);

  useEffect(() => {
    Promise.all([
      fetch('/v1/campaigns?scope=all', { credentials: 'include' }).then((response) => response.json()),
      loadWorkspaces('ad_server').catch(() => [] as WorkspaceOption[]),
    ])
      .then(([payload, workspaceList]) => {
        setCampaigns(payload?.campaigns ?? payload ?? []);
        setWorkspaces(workspaceList);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    fetch(`/v1/tags/${id}`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Not found');
        return response.json();
      })
      .then((tagPayload) => {
        const data = (tagPayload?.tag ?? tagPayload) as Record<string, unknown>;
        const trackerType = data.trackerType === 'impression' ? 'impression' : 'click';
        const format = (data.format as TagFormat | undefined) ?? 'VAST';

        setForm({
          workspaceId: String(data.workspaceId ?? data.workspace_id ?? ''),
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
        setSavedTag(normalizeTagRecord(tagPayload));
        setSuccessMessage('');
      })
      .catch(() => setGeneralError('Failed to load tag.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  useEffect(() => {
    if (isEdit) return;
    if (!videoCampaign) return;
    if (form.format === 'VAST') return;
    setForm((prev) => ({
      ...prev,
      format: 'VAST',
      servingWidth: '',
      servingHeight: '',
      trackerType: 'click',
    }));
    setErrors((current) => ({ ...current, format: undefined }));
  }, [videoCampaign, form.format, isEdit]);

  useEffect(() => {
    if (!selectedCampaignWorkspaceId) return;
    if (form.workspaceId === selectedCampaignWorkspaceId) return;
    setForm((prev) => ({ ...prev, workspaceId: selectedCampaignWorkspaceId }));
    setErrors((current) => ({ ...current, workspaceId: undefined }));
  }, [form.workspaceId, selectedCampaignWorkspaceId]);

  useEffect(() => {
    if (!form.campaignId) return;
    if (!selectedWorkspaceId) return;
    const campaignStillMatchesWorkspace = campaigns.some((campaign) => (
      campaign.id === form.campaignId
      && (campaign.workspaceId ?? campaign.workspace_id ?? '') === selectedWorkspaceId
    ));
    if (campaignStillMatchesWorkspace) return;
    setForm((prev) => ({ ...prev, campaignId: '' }));
  }, [campaigns, form.campaignId, selectedWorkspaceId]);

  useEffect(() => {
    if (form.format === 'tracker' && form.trackerType === 'click') return;
    if (!form.clickUrl) return;
    setForm((prev) => ({ ...prev, clickUrl: '' }));
  }, [form.format, form.trackerType, form.clickUrl]);

  const setField = (field: keyof TagForm) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field !== 'name') setSuccessMessage('');
  };

  const setFormat = (format: TagFormat) => {
    if (isEdit) return;
    setForm((prev) => ({
      ...prev,
      format,
      servingWidth: format === 'display' ? prev.servingWidth : '',
      servingHeight: format === 'display' ? prev.servingHeight : '',
      trackerType: format === 'tracker' ? prev.trackerType : 'click',
    }));
    setErrors((current) => ({ ...current, format: undefined }));
    setSuccessMessage('');
  };

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
    setForm((prev) => ({
      ...prev,
      servingWidth: String(preset.width),
      servingHeight: String(preset.height),
    }));
    setErrors((current) => ({ ...current, servingWidth: undefined, servingHeight: undefined }));
    setSuccessMessage('');
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof TagForm, string>> = {};
    if (!form.workspaceId && !selectedCampaignWorkspaceId) nextErrors.workspaceId = 'Client is required.';
    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (form.format === 'display') {
      const width = Number(form.servingWidth);
      const height = Number(form.servingHeight);
      if (!Number.isFinite(width) || width <= 0) nextErrors.servingWidth = 'Width is required for display tags.';
      if (!Number.isFinite(height) || height <= 0) nextErrors.servingHeight = 'Height is required for display tags.';
    }
    if (form.format === 'tracker' && form.trackerType === 'click' && !form.clickUrl.trim()) {
      nextErrors.clickUrl = 'Click URL is required for click trackers.';
    }
    return nextErrors;
  };

  const validateStep = (step: TagWorkflowStepId) => {
    const nextErrors = validate();
    const scopedErrors: Partial<Record<keyof TagForm, string>> = {};

    if (step === 'campaign' && nextErrors.name) {
      scopedErrors.name = nextErrors.name;
    }
    if (step === 'campaign' && nextErrors.workspaceId) {
      scopedErrors.workspaceId = nextErrors.workspaceId;
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
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return null;
    }

    setSaving(true);
    const nextForm = { ...form, ...overrides };
    const body = {
      workspaceId: nextForm.workspaceId || selectedCampaignWorkspaceId || null,
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
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setGeneralError(payload?.message ?? 'Failed to save tag.');
        return null;
      }

      const payload = await response.json();
      const normalized = normalizeTagRecord(payload);
      setSavedTag(normalized);
      if (Object.keys(overrides).length > 0) {
        setForm((current) => ({ ...current, ...overrides }));
      }
      setSuccessMessage(isEdit ? 'Tag updated successfully.' : 'Tag created successfully.');
      return normalized;
    } catch {
      setGeneralError('Network error. Please try again.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await saveTag();
  };

  return {
    form,
    campaigns: filteredCampaigns,
    workspaces,
    errors,
    generalError,
    loading,
    saving,
    savedTag,
    successMessage,
    selectedCampaignWorkspaceId,
    selectedCampaignDsp,
    videoCampaign,
    selectedCampaignMacroConfig,
    setField,
    setFormat,
    handleDisplaySizePresetChange,
    validateStep,
    saveTag,
    handleSubmit,
    setGeneralError,
    setSuccessMessage,
  };
}

export function useTagDeliveryDiagnostics({
  id,
  isEdit,
  savedTag,
  selectedCampaignDsp,
  setGeneralError,
  setSuccessMessage,
}: {
  id?: string;
  isEdit: boolean;
  savedTag: SavedTag | null;
  selectedCampaignDsp: string;
  setGeneralError: React.Dispatch<React.SetStateAction<string>>;
  setSuccessMessage: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [deliveryDiagnostics, setDeliveryDiagnostics] = useState<DeliveryDiagnosticsPayload | null>(null);
  const [deliveryDiagnosticsLoading, setDeliveryDiagnosticsLoading] = useState(false);
  const [copiedStaticProfile, setCopiedStaticProfile] = useState<string | null>(null);
  const [republishingStaticDelivery, setRepublishingStaticDelivery] = useState(false);
  const [queueingStaticDelivery, setQueueingStaticDelivery] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    void refreshDeliveryDiagnostics();
  }, [id, isEdit]);

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

  async function refreshDeliveryDiagnostics() {
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
  }

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
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to publish static ${profile.label} delivery.`);
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
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Failed to queue static VAST delivery publish.');
      }
      await refreshDeliveryDiagnostics();
      setSuccessMessage('Static VAST delivery queued successfully.');
    } catch (error: any) {
      setGeneralError(error?.message ?? 'Failed to queue static VAST delivery publish.');
    } finally {
      setQueueingStaticDelivery(false);
    }
  };

  return {
    deliveryDiagnostics,
    deliveryDiagnosticsLoading,
    copiedStaticProfile,
    republishingStaticDelivery,
    queueingStaticDelivery,
    basisNativeEnabled,
    dspVideoEnabled,
    basisDiagnosticPath,
    basisFallbackActive,
    staticDeliveryEntries,
    refreshDeliveryDiagnostics,
    handleCopyStaticProfile,
    handleDownloadStaticProfile,
    handleDownloadAllStaticProfiles,
    handleRepublishStaticDelivery,
    handleQueueStaticDelivery,
  };
}

import React from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import TagFormPanel from './TagFormPanel';
import TagDiagnosticsPanel from './TagDiagnosticsPanel';
import TagSnippetPanel from './TagSnippetPanel';
import TagBindingsPanel from './TagBindingsPanel';
import {
  type TagFormat,
} from './tag-builder-shared';
import {
  buildTagWorkflowSteps,
  nextStep,
  previousStep,
  useTagBuilderData,
  useTagDeliveryDiagnostics,
  useTagWorkflow,
  type TagWorkflowStepId,
} from './tag-builder/hooks';
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
} from '../system';
import { ArrowLeft, ArrowRight, CheckCircle2, FileCode, Shield, Sparkles, Tag as TagIcon, Wrench } from '../system/icons';

export default function TagBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEdit = Boolean(id && id !== 'new');
  const { workflowMode, currentStep, setWorkflowStep } = useTagWorkflow({
    isEdit,
    searchParams,
    setSearchParams,
  });
  const {
    form,
    campaigns,
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
  } = useTagBuilderData({
    id,
    isEdit,
  });
  const {
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
  } = useTagDeliveryDiagnostics({
    id,
    isEdit,
    savedTag,
    selectedCampaignDsp,
    setGeneralError,
    setSuccessMessage,
  });

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

  const tagWorkflowSteps = buildTagWorkflowSteps({
    currentStep,
    savedTag,
    deliveryDiagnosticsLoading,
    formStatus: form.status,
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
                      onChange={setField('name')}
                      invalid={Boolean(errors.name)}
                      placeholder="Homepage Leaderboard VAST"
                    />
                  </FormField>
                  <FormField label="Campaign">
                    <Select value={form.campaignId} onChange={setField('campaignId')}>
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
                      <Select value={form.trackerType} onChange={setField('trackerType')}>
                        <option value="click">Click tracker</option>
                        <option value="impression">Impression tracker</option>
                      </Select>
                    </FormField>
                    <FormField label="Destination URL" error={errors.clickUrl}>
                      <Input
                        type="url"
                        value={form.clickUrl}
                        onChange={setField('clickUrl')}
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
                      <Select value={form.status} onChange={setField('status')}>
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
        onSet={setField}
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

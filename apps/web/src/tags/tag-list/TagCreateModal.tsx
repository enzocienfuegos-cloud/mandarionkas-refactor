import React from 'react';
import { Button, Combobox, Input, Modal, Select } from '../../system';
import { DISPLAY_SIZE_PRESETS, type CreateTagForm, type Tag } from './types';

export function TagCreateModal({
  clients,
  campaigns,
  createError,
  createForm,
  onClose,
  onCreate,
  setCreateForm,
}: {
  clients: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string; workspaceId?: string | null }>;
  createError: string;
  createForm: CreateTagForm;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateTagForm>>;
}) {
  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: client.name,
  }));
  const displaySizeOptions = DISPLAY_SIZE_PRESETS.map((preset) => ({
    value: preset.label,
    label: preset.label,
    description: `${preset.width}x${preset.height}`,
  }));
  const availableCampaigns = createForm.workspaceId
    ? campaigns.filter((campaign) => (campaign.workspaceId ?? '') === createForm.workspaceId)
    : campaigns;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Create Tag"
      description="Create the tag first, then configure snippet variants and assignments from the tag workspace."
      footer={(
        <>
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button onClick={() => void onCreate()} variant="primary">Create Tag</Button>
        </>
      )}
    >
      {createError ? (
        <div className="mb-4 rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-3 py-2 text-sm text-[color:var(--dusk-status-critical-fg)]">
          {createError}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Client</label>
          <Combobox
            value={createForm.workspaceId}
            onChange={(value) => {
              const nextWorkspaceId = Array.isArray(value) ? value[0] ?? '' : value;
              setCreateForm((current) => ({
                ...current,
                workspaceId: nextWorkspaceId,
                campaignId: current.workspaceId === nextWorkspaceId ? current.campaignId : '',
              }));
            }}
            options={clientOptions}
            placeholder="Select a client"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Tag Name</label>
          <Input
            value={createForm.name}
            onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Homepage 300x250 display"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Campaign</label>
          <Select
            value={createForm.campaignId}
            onChange={(event) => setCreateForm((current) => ({ ...current, campaignId: event.target.value }))}
            options={[
              { value: '', label: 'No campaign' },
              ...availableCampaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
            ]}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Format</label>
          <div className="flex flex-wrap gap-2">
            {(['VAST', 'display', 'native', 'tracker'] as Tag['format'][]).map((format) => (
              <Button
                key={format}
                type="button"
                onClick={() =>
                  setCreateForm((current) => ({
                    ...current,
                    format,
                    servingWidth: format === 'display' ? current.servingWidth : '',
                    servingHeight: format === 'display' ? current.servingHeight : '',
                    trackerType: format === 'tracker' ? current.trackerType : 'click',
                  }))
                }
                variant={createForm.format === format ? 'primary' : 'secondary'}
                size="sm"
              >
                {format}
              </Button>
            ))}
          </div>
        </div>

        {createForm.format === 'display' ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Display Size</label>
            <Combobox
              value={createForm.servingWidth && createForm.servingHeight ? `${createForm.servingWidth}x${createForm.servingHeight}` : ''}
              onChange={(value) => {
                const selected = Array.isArray(value) ? value[0] ?? '' : value;
                const preset = DISPLAY_SIZE_PRESETS.find((entry) => entry.label === selected);
                setCreateForm((current) => ({
                  ...current,
                  servingWidth: preset ? String(preset.width) : '',
                  servingHeight: preset ? String(preset.height) : '',
                }));
              }}
              options={displaySizeOptions}
              placeholder="Select a size"
            />
          </div>
        ) : null}

        {createForm.format === 'tracker' ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Tracker Type</label>
              <Select
                value={createForm.trackerType}
                onChange={(event) => setCreateForm((current) => ({ ...current, trackerType: event.target.value as 'click' | 'impression' }))}
                options={[
                  { value: 'click', label: 'Click tracker' },
                  { value: 'impression', label: 'Impression tracker' },
                ]}
              />
            </div>
            {createForm.trackerType === 'click' ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Destination URL</label>
                <Input
                  value={createForm.clickUrl}
                  onChange={(event) => setCreateForm((current) => ({ ...current, clickUrl: event.target.value }))}
                  placeholder="https://example.com/landing"
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
          <Select
            value={createForm.status}
            onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as Tag['status'] }))}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
}

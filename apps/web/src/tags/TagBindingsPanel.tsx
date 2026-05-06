import React, { useEffect, useMemo, useState } from 'react';
import {
  assignCreativeVersionToTag,
  loadCreativesWithLatestVersion,
  loadTagBindings,
  updateTagBinding,
  type Creative,
  type CreativeVersion,
  type TagBinding,
} from '../creatives/catalog';

type TagFormat = 'VAST' | 'display' | 'native' | 'tracker';
type TagBindingStatus = TagBinding['status'];

interface SavedTag {
  id: string;
  workspaceId?: string | null;
}

interface CreativeAssignmentOption {
  creative: Creative;
  latestVersion: CreativeVersion;
}

interface TagBindingsPanelProps {
  tagId: string;
  savedTag: SavedTag;
  campaignDsp: string;
  selectedCampaignWorkspaceId: string | null;
  tagFormat: TagFormat;
  tagWidth: number;
  tagHeight: number;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function inputClass(err?: string) {
  return `w-full rounded-lg border bg-surface-1 px-3 py-2.5 text-sm text-[color:var(--dusk-text-primary)] focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 ${
    err ? 'border-red-400 bg-red-50 dark:bg-red-500/10' : 'border-[color:var(--dusk-border-default)]'
  }`;
}

export default function TagBindingsPanel({
  tagId,
  savedTag,
  selectedCampaignWorkspaceId,
  tagFormat,
  tagWidth,
  tagHeight,
  onSuccess,
  onError,
}: TagBindingsPanelProps) {
  const [bindings, setBindings] = useState<TagBinding[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);
  const [bindingDrafts, setBindingDrafts] = useState<Record<string, { weight: string; status: TagBindingStatus }>>({});
  const [updatingBindingId, setUpdatingBindingId] = useState<string | null>(null);
  const [creativeOptions, setCreativeOptions] = useState<CreativeAssignmentOption[]>([]);
  const [creativeOptionsLoading, setCreativeOptionsLoading] = useState(false);
  const [assignmentVersionId, setAssignmentVersionId] = useState('');
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');

  useEffect(() => {
    setBindingsLoading(true);
    setAssignmentError('');
    void loadTagBindings(tagId)
      .then(nextBindings => setBindings(nextBindings))
      .catch(() => {
        setAssignmentError('Failed to load assigned creatives.');
        onError('Failed to load assigned creatives.');
      })
      .finally(() => setBindingsLoading(false));
  }, [tagId, onError]);

  useEffect(() => {
    setBindingDrafts(
      Object.fromEntries(
        bindings.map(binding => [
          binding.id,
          { weight: String(Math.max(1, Number(binding.weight) || 1)), status: binding.status },
        ]),
      ),
    );
  }, [bindings]);

  useEffect(() => {
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
      .catch(() => {
        setAssignmentError('Failed to load available creatives.');
        onError('Failed to load available creatives.');
      })
      .finally(() => setCreativeOptionsLoading(false));
  }, [onError]);

  const filteredCreativeOptions = useMemo(() => {
    const targetWorkspaceId = selectedCampaignWorkspaceId ?? savedTag.workspaceId ?? null;
    return creativeOptions.filter((option) => {
      if (targetWorkspaceId && option.creative.workspaceId && option.creative.workspaceId !== targetWorkspaceId) {
        return false;
      }

      if (tagFormat === 'VAST') {
        return option.latestVersion.servingFormat === 'vast_video';
      }
      if (tagFormat === 'native') {
        return option.latestVersion.servingFormat === 'native';
      }
      if (tagFormat === 'display') {
        if (!['display_html', 'display_image'].includes(option.latestVersion.servingFormat)) {
          return false;
        }
        const creativeWidth = Number(option.latestVersion.width) || 0;
        const creativeHeight = Number(option.latestVersion.height) || 0;
        if (tagWidth > 0 && tagHeight > 0) {
          return creativeWidth === tagWidth && creativeHeight === tagHeight;
        }
        return true;
      }

      return true;
    });
  }, [creativeOptions, savedTag.workspaceId, selectedCampaignWorkspaceId, tagFormat, tagWidth, tagHeight]);

  useEffect(() => {
    setAssignmentVersionId((current) => (
      current && filteredCreativeOptions.some((option) => option.latestVersion.id === current)
        ? current
        : filteredCreativeOptions[0]?.latestVersion.id || ''
    ));
  }, [filteredCreativeOptions]);

  const refreshBindings = async () => {
    const nextBindings = await loadTagBindings(tagId);
    setBindings(nextBindings);
  };

  const handleAssignCreative = async () => {
    if (!assignmentVersionId) {
      setAssignmentError('Select a creative to assign.');
      onError('Select a creative to assign.');
      return;
    }

    setAssignmentBusy(true);
    setAssignmentError('');

    try {
      await assignCreativeVersionToTag({
        creativeVersionId: assignmentVersionId,
        tagId,
      });
      await refreshBindings();
      const selectedOption = filteredCreativeOptions.find(option => option.latestVersion.id === assignmentVersionId);
      const message = selectedOption
        ? `Creative "${selectedOption.creative.name}" assigned successfully.`
        : 'Creative assigned successfully.';
      onSuccess(message);
    } catch (error: any) {
      const message = error?.message ?? 'Failed to assign creative.';
      setAssignmentError(message);
      onError(message);
    } finally {
      setAssignmentBusy(false);
    }
  };

  const handleBindingDraftChange = (
    bindingId: string,
    field: 'weight' | 'status',
    value: string,
  ) => {
    setBindingDrafts(current => ({
      ...current,
      [bindingId]: {
        weight: current[bindingId]?.weight ?? '1',
        status: current[bindingId]?.status ?? 'active',
        [field]: value,
      } as { weight: string; status: TagBindingStatus },
    }));
    setAssignmentError('');
  };

  const handleSaveBinding = async (binding: TagBinding) => {
    const draft = bindingDrafts[binding.id] ?? {
      weight: String(Math.max(1, Number(binding.weight) || 1)),
      status: binding.status,
    };
    const parsedWeight = Math.max(1, Number.parseInt(draft.weight, 10) || 1);

    setUpdatingBindingId(binding.id);
    setAssignmentError('');

    try {
      await updateTagBinding({
        tagId,
        bindingId: binding.id,
        status: draft.status,
        weight: parsedWeight,
      });
      await refreshBindings();
      onSuccess(`Rotation updated for "${binding.creativeName}".`);
    } catch (error: any) {
      const message = error?.message ?? 'Failed to update creative rotation.';
      setAssignmentError(message);
      onError(message);
    } finally {
      setUpdatingBindingId(null);
    }
  };

  const handleToggleBindingStatus = async (binding: TagBinding) => {
    const nextStatus: TagBindingStatus = binding.status === 'active' ? 'paused' : 'active';
    handleBindingDraftChange(binding.id, 'status', nextStatus);
    setUpdatingBindingId(binding.id);
    setAssignmentError('');

    try {
      await updateTagBinding({
        tagId: binding.tagId,
        bindingId: binding.id,
        status: nextStatus,
        weight: Math.max(1, Number(bindingDrafts[binding.id]?.weight ?? binding.weight) || 1),
      });
      await refreshBindings();
      onSuccess(
        nextStatus === 'active'
          ? `Creative "${binding.creativeName}" activated for rotation.`
          : `Creative "${binding.creativeName}" paused from rotation.`,
      );
    } catch (error: any) {
      const message = error?.message ?? 'Failed to update creative status.';
      setAssignmentError(message);
      onError(message);
    } finally {
      setUpdatingBindingId(null);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-6">
      <div className="flex flex-col gap-1 mb-5">
        <h2 className="text-base font-semibold text-[color:var(--dusk-text-primary)]">Creative Assignments</h2>
        <p className="text-sm text-[color:var(--dusk-text-secondary)]">
          Assign creatives directly from this tag. For display tags, only compatible sizes can be attached.
        </p>
      </div>

      {assignmentError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {assignmentError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-xl border border-[color:var(--dusk-border-default)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Assigned Creatives</h3>
            {bindingsLoading && <span className="text-xs text-[color:var(--dusk-text-secondary)]">Loading…</span>}
          </div>

          {bindings.length === 0 && !bindingsLoading ? (
            <div className="rounded-lg border border-dashed border-[color:var(--dusk-border-default)] px-4 py-6 text-sm text-[color:var(--dusk-text-secondary)]">
              No creatives assigned yet.
            </div>
          ) : (
            <div className="space-y-3">
              {bindings.map(binding => (
                <div key={binding.id} className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--dusk-text-primary)]">{binding.creativeName}</p>
                      <p className="text-xs text-[color:var(--dusk-text-secondary)]">
                        {binding.variantLabel
                          ? `${binding.variantLabel} • ${binding.variantWidth ?? '?'}x${binding.variantHeight ?? '?'}`
                          : binding.servingFormat}
                      </p>
                    </div>
                    <span className="rounded-full border border-[color:var(--dusk-border-default)] bg-surface-1 px-2.5 py-1 text-xs font-medium text-[color:var(--dusk-text-secondary)]">
                      {binding.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,110px)_minmax(0,140px)_1fr]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-tertiary)]">Weight</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={bindingDrafts[binding.id]?.weight ?? String(binding.weight)}
                        onChange={(event) => handleBindingDraftChange(binding.id, 'weight', event.target.value)}
                        className={inputClass()}
                        disabled={updatingBindingId === binding.id}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-text-tertiary)]">Status</span>
                      <select
                        value={bindingDrafts[binding.id]?.status ?? binding.status}
                        onChange={(event) => handleBindingDraftChange(binding.id, 'status', event.target.value)}
                        className={inputClass()}
                        disabled={updatingBindingId === binding.id}
                      >
                        <option value="active">active</option>
                        <option value="paused">paused</option>
                        <option value="draft">draft</option>
                        <option value="archived">archived</option>
                      </select>
                    </label>
                    <div className="flex flex-wrap items-end gap-2">
                      <button
                        type="button"
                        onClick={() => { void handleSaveBinding(binding); }}
                        disabled={updatingBindingId === binding.id}
                        className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-xs font-medium text-fuchsia-700 transition-colors hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:hover:bg-fuchsia-500/20"
                      >
                        {updatingBindingId === binding.id ? 'Saving…' : 'Save Rotation'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleToggleBindingStatus(binding); }}
                        disabled={updatingBindingId === binding.id}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          binding.status === 'active'
                            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/20'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
                        }`}
                      >
                        {binding.status === 'active' ? 'Pause' : 'Activate'}
                      </button>
                      <div className="text-xs text-[color:var(--dusk-text-secondary)]">
                        Higher weight means this creative is selected more often during rotation.
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[color:var(--dusk-border-default)] p-4">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--dusk-text-primary)]">Assign Creative</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-primary)]">Creative</label>
              <select
                value={assignmentVersionId}
                onChange={event => {
                  setAssignmentVersionId(event.target.value);
                  setAssignmentError('');
                }}
                className={inputClass()}
                disabled={creativeOptionsLoading || assignmentBusy}
              >
                <option value="">Select a creative</option>
                {filteredCreativeOptions.map(option => (
                  <option key={option.latestVersion.id} value={option.latestVersion.id}>
                    {option.creative.name} · v{option.latestVersion.versionNumber}
                  </option>
                ))}
              </select>
              {filteredCreativeOptions.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  No creatives match this tag yet. We only show creatives from the selected client and, for display tags, only the exact assigned size.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAssignCreative}
              disabled={assignmentBusy || creativeOptionsLoading || !assignmentVersionId}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-brand-gradient hover:opacity-95 disabled:opacity-60 rounded-lg transition-colors"
            >
              {assignmentBusy ? 'Assigning…' : 'Assign Creative'}
            </button>

            <p className="text-xs text-[color:var(--dusk-text-secondary)]">
              This uses the latest available version for the selected creative and respects format and size constraints on the API side.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

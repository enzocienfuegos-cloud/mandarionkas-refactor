import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type Creative,
  type CreativeVersion,
  type CreativeIngestion,
  type CreativeSizeVariant,
  type TagOption,
  type TagBinding,
  assignCreativeVersionToTag,
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  loadCreativesWithLatestVersion,
  loadCreativeIngestions,
  loadCreativeSizeVariants,
  loadTagBindings,
  loadTags,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  submitCreativeVersion,
  updateTagBinding,
} from './catalog';
import { createClientWorkspace, loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';

function formatBytes(value?: number | null) {
  if (!value) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = units[0];
  for (let index = 0; index < units.length - 1 && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index + 1];
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function sourceBadge(version?: CreativeVersion | null) {
  const source = version?.sourceKind ?? 'legacy';
  const labels: Record<string, string> = {
    legacy: 'Legacy',
    studio_export: 'Studio',
    html5_zip: 'HTML5 ZIP',
    video_mp4: 'MP4',
  };
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {labels[source] ?? source}
    </span>
  );
}

function statusBadge(status?: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    pending_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-700',
    published: 'bg-blue-100 text-blue-700',
    validated: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-rose-100 text-rose-700',
    processing: 'bg-purple-100 text-purple-700',
    uploaded: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status ?? 'draft'] ?? map.draft}`}>
      {(status ?? 'draft').replace(/_/g, ' ')}
    </span>
  );
}

function readinessBadge(variant: CreativeSizeVariant) {
  const ready = Boolean(variant.publicUrl) && (variant.status === 'active' || variant.status === 'draft' || variant.status === 'paused');
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
    }`}>
      {ready ? 'Ready' : 'Needs artifact'}
    </span>
  );
}

type LatestVersionMap = Record<string, CreativeVersion | null>;

const VARIANT_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

interface BindingState {
  creativeId: string;
  versionId: string;
  tagId: string;
  loading: boolean;
  error: string;
  bindingsLoading: boolean;
  bindings: TagBinding[];
}

interface VariantState {
  creativeId: string;
  creativeName: string;
  versionId: string;
  loading: boolean;
  error: string;
  variants: CreativeSizeVariant[];
  selectedVariantIds: string[];
  form: {
    label: string;
    width: string;
    height: string;
  };
}

export default function CreativeLibrary() {
  const navigate = useNavigate();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [ingestions, setIngestions] = useState<CreativeIngestion[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [bindingState, setBindingState] = useState<BindingState | null>(null);
  const [variantState, setVariantState] = useState<VariantState | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ creatives, latestVersions }, ingestions, tags, authMe, workspaceList] = await Promise.all([
        loadCreativesWithLatestVersion(),
        loadCreativeIngestions(),
        loadTags(),
        loadAuthMe(),
        loadWorkspaces(),
      ]);
      setCreatives(creatives);
      setLatestVersions(latestVersions);
      setIngestions(ingestions);
      setTags(tags);
      setWorkspaces(workspaceList);
      setActiveWorkspaceId(authMe.workspace?.id ?? workspaceList[0]?.id ?? '');
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load creative catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const versions = Object.values(latestVersions).filter(Boolean) as CreativeVersion[];
    return {
      totalCreatives: creatives.length,
      pendingReview: versions.filter(version => version.status === 'pending_review').length,
      approved: versions.filter(version => version.status === 'approved').length,
      ingestions: ingestions.length,
    };
  }, [creatives, latestVersions, ingestions]);

  const handleWorkspaceChange = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === activeWorkspaceId) return;
    setWorkspaceBusy(true);
    setError('');
    try {
      await switchWorkspace(workspaceId);
      await load();
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to switch client');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleCreateClient = async () => {
    const name = window.prompt('New client name');
    if (!name?.trim()) return;
    setWorkspaceBusy(true);
    setError('');
    try {
      await createClientWorkspace(name.trim());
      await load();
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to create client');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleSubmit = async (creativeId: string) => {
    const version = latestVersions[creativeId];
    if (!version) return;
    setSubmitting(version.id);
    try {
      const response = await submitCreativeVersion(version.id);
      setLatestVersions(current => ({
        ...current,
        [creativeId]: response.creativeVersion,
      }));
    } catch {
      alert('Failed to submit creative version for review.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleAssign = async () => {
    if (!bindingState?.tagId) {
      setBindingState(current => current ? { ...current, error: 'Select a tag.' } : current);
      return;
    }
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await assignCreativeVersionToTag({
        creativeVersionId: bindingState.versionId,
        tagId: bindingState.tagId,
      });
      const bindings = await loadTagBindings(bindingState.tagId);
      setBindingState(current => current ? { ...current, loading: false, bindings } : current);
    } catch (assignError: any) {
      setBindingState(current => current ? { ...current, loading: false, error: assignError.message ?? 'Binding failed' } : current);
    }
  };

  const handleBindingStatusChange = async (bindingId: string, status: 'active' | 'paused') => {
    if (!bindingState?.tagId) return;
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateTagBinding({
        tagId: bindingState.tagId,
        bindingId,
        status,
      });
      const bindings = await loadTagBindings(bindingState.tagId);
      setBindingState(current => current ? { ...current, loading: false, bindings } : current);
    } catch (updateError: any) {
      setBindingState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Binding update failed' } : current);
    }
  };

  const openVariantManager = async (creative: Creative, version: CreativeVersion) => {
    setVariantState({
      creativeId: creative.id,
      creativeName: creative.name,
      versionId: version.id,
      loading: true,
      error: '',
      variants: [],
      selectedVariantIds: [],
      form: {
        label: version.width && version.height ? `${version.width}x${version.height}` : '',
        width: version.width ? String(version.width) : '',
        height: version.height ? String(version.height) : '',
      },
    });
    try {
      const variants = await loadCreativeSizeVariants(version.id);
      setVariantState(current => current ? { ...current, loading: false, variants, selectedVariantIds: [] } : current);
    } catch (loadError: any) {
      setVariantState(current => current ? {
        ...current,
        loading: false,
        error: loadError.message ?? 'Failed to load size variants',
        selectedVariantIds: [],
      } : current);
    }
  };

  const handleVariantStatusChange = async (variantId: string, status: 'active' | 'paused') => {
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateCreativeSizeVariant({ variantId, status });
      const variants = await loadCreativeSizeVariants(variantState?.versionId ?? '');
      setVariantState(current => current ? { ...current, loading: false, variants } : current);
    } catch (updateError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update variant' } : current);
    }
  };

  const toggleVariantSelection = (variantId: string) => {
    setVariantState(current => {
      if (!current) return current;
      const selected = current.selectedVariantIds.includes(variantId)
        ? current.selectedVariantIds.filter(id => id !== variantId)
        : [...current.selectedVariantIds, variantId];
      return { ...current, selectedVariantIds: selected };
    });
  };

  const toggleSelectAllVariants = () => {
    setVariantState(current => {
      if (!current) return current;
      const selectableIds = current.variants.map(variant => variant.id);
      const selectedVariantIds = current.selectedVariantIds.length === selectableIds.length
        ? []
        : selectableIds;
      return { ...current, selectedVariantIds };
    });
  };

  const handleCreateVariant = async () => {
    if (!variantState) return;
    const width = Number(variantState.form.width);
    const height = Number(variantState.form.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      setVariantState(current => current ? { ...current, error: 'Width and height must be positive numbers.' } : current);
      return;
    }

    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await createCreativeSizeVariant({
        creativeVersionId: variantState.versionId,
        label: variantState.form.label.trim() || `${width}x${height}`,
        width,
        height,
        status: 'draft',
      });
      const variants = await loadCreativeSizeVariants(variantState.versionId);
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants,
        selectedVariantIds: [],
        form: { ...current.form, label: '', width: '', height: '' },
      } : current);
    } catch (createError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create variant' } : current);
    }
  };

  const handleCreatePresetVariants = async (presets: typeof VARIANT_PRESETS) => {
    if (!variantState || presets.length === 0) return;
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await createCreativeSizeVariantsBulk({
        creativeVersionId: variantState.versionId,
        variants: presets.map(preset => ({
          label: preset.label,
          width: preset.width,
          height: preset.height,
          status: 'draft',
        })),
      });
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
        error: response.skippedCount > 0 ? `${response.skippedCount} duplicate size(s) skipped.` : '',
      } : current);
    } catch (createError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create preset sizes' } : current);
    }
  };

  const handleBulkVariantStatusChange = async (status: 'active' | 'paused') => {
    if (!variantState || variantState.selectedVariantIds.length === 0) {
      setVariantState(current => current ? { ...current, error: 'Select at least one size first.' } : current);
      return;
    }
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await updateCreativeSizeVariantsBulkStatus({
        creativeVersionId: variantState.versionId,
        variantIds: variantState.selectedVariantIds,
        status,
      });
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
      } : current);
    } catch (updateError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update selected sizes' } : current);
    }
  };

  useEffect(() => {
    if (!bindingState?.tagId) return;

    let cancelled = false;
    setBindingState(current => current ? { ...current, bindingsLoading: true, error: '' } : current);
    void loadTagBindings(bindingState.tagId)
      .then(bindings => {
        if (cancelled) return;
        setBindingState(current => current ? { ...current, bindingsLoading: false, bindings } : current);
      })
      .catch(loadError => {
        if (cancelled) return;
        setBindingState(current => current ? {
          ...current,
          bindingsLoading: false,
          error: loadError.message ?? 'Failed to load tag bindings',
        } : current);
      });

    return () => {
      cancelled = true;
    };
  }, [bindingState?.tagId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Error loading creative catalog</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Creative Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload to a specific client, auto-publish technically valid creatives, and bind them to tags.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={activeWorkspaceId}
            onChange={event => void handleWorkspaceChange(event.target.value)}
            disabled={workspaceBusy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {workspaces.map(workspace => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void handleCreateClient()}
            disabled={workspaceBusy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            New client
          </button>
          <button
            onClick={() => navigate('/creatives/approval')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Review Queue
          </button>
          <button
            onClick={() => navigate('/creatives/upload')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Upload Creative
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Creatives</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalCreatives}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Manual Review</p>
          <p className="mt-2 text-2xl font-semibold text-yellow-700">{summary.pendingReview}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Ready to Tag</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{summary.approved}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Ingestions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.ingestions}</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Creative Versions</h2>
          <button onClick={() => void load()} className="text-sm text-indigo-600 hover:text-indigo-700">Refresh</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Creative</th>
                <th className="px-4 py-3">Latest Version</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Preview</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {creatives.map(creative => {
                const version = latestVersions[creative.id];
                return (
                  <tr key={creative.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{creative.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(creative.createdAt).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {version ? `v${version.versionNumber}` : '—'}
                    </td>
                    <td className="px-4 py-3">{sourceBadge(version)}</td>
                    <td className="px-4 py-3">{statusBadge(version?.status ?? creative.approvalStatus)}</td>
                    <td className="px-4 py-3">
                      {version?.publicUrl ? (
                        <a
                          href={version.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-slate-400">No public artifact</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {version && (version.status === 'draft' || version.status === 'rejected') && (
                          <button
                            onClick={() => void handleSubmit(creative.id)}
                            disabled={submitting === version.id}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:bg-slate-400"
                          >
                            {submitting === version.id ? 'Submitting…' : 'Submit for review'}
                          </button>
                        )}
                        {version && version.status === 'approved' && (
                          <>
                            <button
                              onClick={() => void openVariantManager(creative, version)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Manage sizes
                            </button>
                            <button
                              onClick={() => setBindingState({
                                creativeId: creative.id,
                                versionId: version.id,
                                tagId: '',
                                loading: false,
                                error: '',
                                bindingsLoading: false,
                                bindings: [],
                              })}
                              className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                            >
                              Assign to tag
                            </button>
                          </>
                        )}
                        {!version && <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Recent Ingestions</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {ingestions.map(ingestion => (
            <div key={ingestion.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-800">{ingestion.originalFilename}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {ingestion.sourceKind} · {formatBytes(ingestion.sizeBytes)} · {new Date(ingestion.createdAt).toLocaleString()}
                  </div>
                </div>
                {statusBadge(ingestion.status)}
              </div>
              {ingestion.errorDetail && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{ingestion.errorDetail}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span>creative: {ingestion.creativeId ?? '—'}</span>
                <span>version: {ingestion.creativeVersionId ?? '—'}</span>
              </div>
            </div>
          ))}
          {ingestions.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No ingestions yet. Upload an HTML5 zip or MP4 to seed the new catalog.
            </div>
          )}
        </div>
      </section>

      {bindingState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">Assign creative version to tag</h2>
            <p className="mt-1 text-sm text-slate-500">
              Bind the approved version to a delivery tag using the new versioned serving path.
            </p>
            {bindingState.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {bindingState.error}
              </div>
            )}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Tag</label>
              <select
                value={bindingState.tagId}
                onChange={event => setBindingState(current => current ? { ...current, tagId: event.target.value } : current)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a tag</option>
                {tags.map(tag => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name} · {tag.format} · {tag.status}
                  </option>
                ))}
              </select>
            </div>
            {bindingState.tagId && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">Current bindings</h3>
                    <p className="text-xs text-slate-500">Review what this tag is already serving before you change it.</p>
                  </div>
                  {bindingState.bindingsLoading && (
                    <span className="text-xs text-slate-500">Loading…</span>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {bindingState.bindings.map(binding => {
                    const isCurrentVersion = binding.creativeVersionId === bindingState.versionId;
                    return (
                      <div key={binding.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-800">{binding.creativeName}</span>
                              {statusBadge(binding.status)}
                              {isCurrentVersion && (
                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  Selected version
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {binding.sourceKind} · {binding.servingFormat} · weight {binding.weight}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {binding.status === 'active' ? (
                              <button
                                onClick={() => void handleBindingStatusChange(binding.id, 'paused')}
                                disabled={bindingState.loading}
                                className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                              >
                                Pause
                              </button>
                            ) : (
                              <button
                                onClick={() => void handleBindingStatusChange(binding.id, 'active')}
                                disabled={bindingState.loading}
                                className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!bindingState.bindingsLoading && bindingState.bindings.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                      This tag has no bindings yet.
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setBindingState(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleAssign()}
                disabled={bindingState.loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {bindingState.loading ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {variantState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Resolution management</h2>
                <p className="mt-1 text-sm text-slate-500">{variantState.creativeName}</p>
              </div>
              <button
                onClick={() => setVariantState(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Preset sizes</h3>
                    <p className="mt-1 text-xs text-slate-500">Seed the matrix with common display resolutions in one action.</p>
                  </div>
                  <button
                    onClick={() => void handleCreatePresetVariants(VARIANT_PRESETS)}
                    disabled={variantState.loading}
                    className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  >
                    Add standard set
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VARIANT_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => void handleCreatePresetVariants([preset])}
                      disabled={variantState.loading}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
                <input
                  value={variantState.form.label}
                  onChange={event => setVariantState(current => current ? { ...current, form: { ...current.form, label: event.target.value } } : current)}
                  placeholder="300x250 · Mobile"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={variantState.form.width}
                  onChange={event => setVariantState(current => current ? { ...current, form: { ...current.form, width: event.target.value } } : current)}
                  placeholder="Width"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={variantState.form.height}
                  onChange={event => setVariantState(current => current ? { ...current, form: { ...current.form, height: event.target.value } } : current)}
                  placeholder="Height"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => void handleCreateVariant()}
                  disabled={variantState.loading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  Add size
                </button>
              </div>

              {variantState.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {variantState.error}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={variantState.variants.length > 0 && variantState.selectedVariantIds.length === variantState.variants.length}
                        onChange={toggleSelectAllVariants}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Select all
                    </label>
                    <span className="text-xs text-slate-500">
                      {variantState.selectedVariantIds.length} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleBulkVariantStatusChange('active')}
                      disabled={variantState.loading || variantState.selectedVariantIds.length === 0}
                      className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    >
                      Activate selected
                    </button>
                    <button
                      onClick={() => void handleBulkVariantStatusChange('paused')}
                      disabled={variantState.loading || variantState.selectedVariantIds.length === 0}
                      className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                    >
                      Pause selected
                    </button>
                  </div>
                </div>
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Readiness</th>
                      <th className="px-4 py-3">Bindings</th>
                      <th className="px-4 py-3">Preview</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {variantState.variants.map(variant => (
                      <tr key={variant.id}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={variantState.selectedVariantIds.includes(variant.id)}
                            onChange={() => toggleVariantSelection(variant.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{variant.label}</td>
                        <td className="px-4 py-3 text-slate-600">{variant.width}×{variant.height}</td>
                        <td className="px-4 py-3">{statusBadge(variant.status)}</td>
                        <td className="px-4 py-3">{readinessBadge(variant)}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-600">
                            <div>{variant.activeBindingCount ?? 0} active / {variant.bindingCount ?? 0} total</div>
                            {variant.tagNames && variant.tagNames.length > 0 && (
                              <div className="mt-1 truncate text-slate-500" title={variant.tagNames.join(', ')}>
                                {variant.tagNames.slice(0, 3).join(', ')}
                                {variant.tagNames.length > 3 ? ` +${variant.tagNames.length - 3}` : ''}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-xs">
                            {variant.publicUrl ? (
                              <a href={variant.publicUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-700">
                                Open
                              </a>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                            <div className="text-slate-500">
                              {variant.totalImpressions ?? 0} imps / {variant.totalClicks ?? 0} clicks
                            </div>
                            <div className="text-slate-500">
                              CTR {(variant.ctr ?? 0).toFixed(2)}% · 7d {(variant.impressions7d ?? 0)} imps
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {variant.status === 'active' ? (
                            <button
                              onClick={() => void handleVariantStatusChange(variant.id, 'paused')}
                              disabled={variantState.loading}
                              className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Pause
                            </button>
                          ) : (
                            <button
                              onClick={() => void handleVariantStatusChange(variant.id, 'active')}
                              disabled={variantState.loading}
                              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Activate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!variantState.loading && variantState.variants.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                          No size variants yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

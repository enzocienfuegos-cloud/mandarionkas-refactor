import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  assignCreativeVersionToTag,
  createTag,
  loadTagBindings,
  loadTags,
  updateTagBinding,
  type Creative,
  type CreativeVersion,
  type TagOption,
} from '../catalog';
import { switchWorkspace } from '../../shared/workspaces';
import type { BindingState, QuickCreateTagState } from './types';

type Params = {
  activeWorkspaceId: string;
  setActiveWorkspaceId: Dispatch<SetStateAction<string>>;
  setWorkspaceBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setSuccessMessage: Dispatch<SetStateAction<string>>;
  setTags: Dispatch<SetStateAction<TagOption[]>>;
  tags: TagOption[];
};

export function useTagBindingManager({
  activeWorkspaceId,
  setActiveWorkspaceId,
  setWorkspaceBusy,
  setError,
  setSuccessMessage,
  setTags,
  tags,
}: Params) {
  const [bindingState, setBindingState] = useState<BindingState | null>(null);
  const [quickCreateTagState, setQuickCreateTagState] = useState<QuickCreateTagState | null>(null);

  const handleAssign = async () => {
    if (!bindingState?.tagId) {
      setBindingState((current) => current ? { ...current, error: 'Select a tag.' } : current);
      return;
    }
    const selectedTag = tags.find((tag) => tag.id === bindingState.tagId);
    setBindingState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      await assignCreativeVersionToTag({
        creativeVersionId: bindingState.versionId,
        tagId: bindingState.tagId,
      });
      setBindingState(null);
      setSuccessMessage(selectedTag ? `Assigned to tag "${selectedTag.name}".` : 'Creative assigned to tag.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (assignError: any) {
      const message = assignError?.message ?? 'Assignment failed';
      setBindingState((current) => current ? { ...current, loading: false, error: message } : current);
    }
  };

  const handlePrepareBinding = async (creative: Creative, version: CreativeVersion) => {
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      const nextTags = await loadTags({ workspaceId: creative.workspaceId ?? activeWorkspaceId });
      setTags(nextTags);
      setBindingState({
        creativeId: creative.id,
        creativeName: creative.name,
        versionId: version.id,
        servingFormat: version.servingFormat,
        tagId: '',
        loading: false,
        error: '',
        bindingsLoading: false,
        bindings: [],
      });
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to prepare assignment');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleQuickCreateTag = async () => {
    if (!bindingState) return;
    const suggestedFormat =
      bindingState.servingFormat === 'vast_video'
        ? 'VAST'
        : bindingState.servingFormat === 'native'
          ? 'native'
          : 'display';
    const suggestedName = `${bindingState.creativeName} ${suggestedFormat}`.trim();
    setQuickCreateTagState({
      suggestedFormat,
      creativeName: bindingState.creativeName,
      name: suggestedName,
      loading: false,
      error: '',
    });
  };

  const handleConfirmQuickCreateTag = async () => {
    if (!bindingState || !quickCreateTagState) return;
    const name = quickCreateTagState.name.trim();
    if (!name) {
      setQuickCreateTagState((current) => current ? { ...current, error: 'Tag name is required.' } : current);
      return;
    }

    setQuickCreateTagState((current) => current ? { ...current, loading: true, error: '' } : current);
    setBindingState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      const createdTag = await createTag({
        name,
        format: quickCreateTagState.suggestedFormat as 'display' | 'native' | 'VAST',
        status: 'draft',
      });
      const [nextTags, bindings] = await Promise.all([
        loadTags(),
        createdTag?.id ? loadTagBindings(createdTag.id) : Promise.resolve([]),
      ]);
      setTags(nextTags);
      setBindingState((current) => current ? {
        ...current,
        loading: false,
        tagId: createdTag?.id ?? '',
        bindings,
      } : current);
      setQuickCreateTagState(null);
    } catch (createError: any) {
      setBindingState((current) => current ? {
        ...current,
        loading: false,
        error: createError.message ?? 'Failed to create tag',
      } : current);
      setQuickCreateTagState((current) => current ? {
        ...current,
        loading: false,
        error: createError.message ?? 'Failed to create tag',
      } : current);
    }
  };

  const handleBindingStatusChange = async (bindingId: string, status: 'active' | 'paused') => {
    if (!bindingState?.tagId) return;
    setBindingState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateTagBinding({
        tagId: bindingState.tagId,
        bindingId,
        status,
      });
      const bindings = await loadTagBindings(bindingState.tagId);
      setBindingState((current) => current ? { ...current, loading: false, bindings } : current);
    } catch (updateError: any) {
      setBindingState((current) => current ? {
        ...current,
        loading: false,
        error: updateError.message ?? 'Binding update failed',
      } : current);
    }
  };

  useEffect(() => {
    if (!bindingState?.tagId) return;

    let cancelled = false;
    setBindingState((current) => current ? { ...current, bindingsLoading: true, error: '' } : current);
    void loadTagBindings(bindingState.tagId)
      .then((bindings) => {
        if (cancelled) return;
        setBindingState((current) => current ? { ...current, bindingsLoading: false, bindings } : current);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setBindingState((current) => current ? {
          ...current,
          bindingsLoading: false,
          error: loadError.message ?? 'Failed to load tag bindings',
        } : current);
      });

    return () => {
      cancelled = true;
    };
  }, [bindingState?.tagId]);

  return {
    bindingState,
    setBindingState,
    quickCreateTagState,
    setQuickCreateTagState,
    handleAssign,
    handlePrepareBinding,
    handleQuickCreateTag,
    handleConfirmQuickCreateTag,
    handleBindingStatusChange,
  };
}

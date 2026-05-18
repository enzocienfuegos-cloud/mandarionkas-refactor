import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  assignCreativeVersionToTag,
  createTag,
  deleteCreativeById,
  updateCreativeById,
  updateCreativeVersionById,
  type Creative,
  type CreativeVersion,
  type TagOption,
} from '../catalog';
import { switchWorkspace } from '../../shared/workspaces';
import type { ClickUrlEditorState, LatestVersionMap } from './types';

type ConfirmFn = (options: any) => Promise<boolean>;

type Params = {
  activeWorkspaceId: string;
  setActiveWorkspaceId: Dispatch<SetStateAction<string>>;
  setWorkspaceBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setSuccessMessage: Dispatch<SetStateAction<string>>;
  creatives: Creative[];
  setCreatives: Dispatch<SetStateAction<Creative[]>>;
  latestVersions: LatestVersionMap;
  setLatestVersions: Dispatch<SetStateAction<LatestVersionMap>>;
  selectedCreativeIds: string[];
  setSelectedCreativeIds: Dispatch<SetStateAction<string[]>>;
  bulkClickUrl: string;
  setBulkClickUrl: Dispatch<SetStateAction<string>>;
  bulkAssignTagId: string;
  setBulkAssignTagId: Dispatch<SetStateAction<string>>;
  selectedCreativeWorkspaceIds: string[];
  selectedCreativeFormatFamilies: string[];
  selectedCreatives: Creative[];
  tags: TagOption[];
  load: () => Promise<void>;
  confirm: ConfirmFn;
};

export function useCreativeCatalogActions({
  activeWorkspaceId,
  setActiveWorkspaceId,
  setWorkspaceBusy,
  setError,
  setSuccessMessage,
  creatives,
  setCreatives,
  latestVersions,
  setLatestVersions,
  selectedCreativeIds,
  setSelectedCreativeIds,
  bulkClickUrl,
  setBulkClickUrl,
  bulkAssignTagId,
  setBulkAssignTagId,
  selectedCreativeWorkspaceIds,
  selectedCreativeFormatFamilies,
  selectedCreatives,
  tags,
  load,
  confirm,
}: Params) {
  const [clickUrlEditor, setClickUrlEditor] = useState<ClickUrlEditorState | null>(null);
  const [bulkClickUrlSaving, setBulkClickUrlSaving] = useState(false);
  const [bulkAssignSaving, setBulkAssignSaving] = useState(false);
  const [bulkCreateTagSaving, setBulkCreateTagSaving] = useState(false);
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
  const [statusUpdateCreativeId, setStatusUpdateCreativeId] = useState('');

  const handleDeleteCreative = async (creative: Creative) => {
    const confirmed = await confirm({
      title: `Delete "${creative.name}"?`,
      description: 'This will remove its published versions and assignments.',
      tone: 'danger',
      confirmLabel: 'Delete creative',
      requireTypeToConfirm: creative.name,
    });
    if (!confirmed) return;

    setError('');
    setSuccessMessage('');
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      await deleteCreativeById(creative.id);
      await load();
      setSuccessMessage(`Deleted "${creative.name}".`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (deleteError: any) {
      setError(deleteError.message ?? 'Failed to delete creative');
    }
  };

  const handleBulkClickUrlUpdate = async () => {
    const normalized = bulkClickUrl.trim();
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    let parsedClickUrl = '';
    try {
      parsedClickUrl = new URL(normalized).toString();
    } catch (_) {
      setError('Enter a valid http(s) destination URL for the selected creatives.');
      return;
    }

    setBulkClickUrlSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
      for (const creative of selectedCreatives) {
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        await updateCreativeById({
          creativeId: creative.id,
          clickUrl: parsedClickUrl,
        });
      }
      setCreatives((current) => current.map((creative) => (
        selectedCreativeIds.includes(creative.id)
          ? { ...creative, clickUrl: parsedClickUrl }
          : creative
      )));
      setSelectedCreativeIds([]);
      setBulkClickUrl('');
      setSuccessMessage(`Updated destination URL for ${selectedCreatives.length} creative${selectedCreatives.length === 1 ? '' : 's'}.`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update destination URLs');
    } finally {
      setWorkspaceBusy(false);
      setBulkClickUrlSaving(false);
    }
  };

  const handleEditCreativeClickUrl = async (creative: Creative) => {
    setClickUrlEditor({
      creativeId: creative.id,
      creativeName: creative.name,
      workspaceId: creative.workspaceId ?? null,
      value: creative.clickUrl ?? '',
      loading: false,
      error: '',
    });
  };

  const handleSaveCreativeClickUrl = async () => {
    if (!clickUrlEditor) return;
    const normalized = clickUrlEditor.value.trim();
    if (normalized) {
      try {
        new URL(normalized);
      } catch (_) {
        setError('Enter a valid http(s) destination URL for the creative.');
        return;
      }
    }

    setClickUrlEditor((current) => current ? { ...current, loading: true, error: '' } : current);
    setError('');
    setSuccessMessage('');
    try {
      if (clickUrlEditor.workspaceId && clickUrlEditor.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(clickUrlEditor.workspaceId);
        setActiveWorkspaceId(clickUrlEditor.workspaceId);
      }
      await updateCreativeById({
        creativeId: clickUrlEditor.creativeId,
        clickUrl: normalized || null,
      });
      setCreatives((current) => current.map((entry) => (
        entry.id === clickUrlEditor.creativeId
          ? { ...entry, clickUrl: normalized || null }
          : entry
      )));
      setSuccessMessage(normalized ? 'Creative destination URL updated.' : 'Creative destination URL cleared.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
      setClickUrlEditor(null);
    } catch (updateError: any) {
      const message = updateError.message ?? 'Failed to update creative destination URL';
      setError(message);
      setClickUrlEditor((current) => current ? { ...current, loading: false, error: message } : current);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleBulkAssignToTag = async () => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    if (selectedCreativeWorkspaceIds.length !== 1) {
      setError('Bulk assignment only works when all selected creatives belong to the same client.');
      return;
    }
    if (selectedCreativeFormatFamilies.length !== 1 || selectedCreativeFormatFamilies[0] === 'unknown') {
      setError('Bulk assignment only works when all selected creatives share the same delivery type and have a latest version.');
      return;
    }
    if (!bulkAssignTagId) {
      setError('Select a destination tag first.');
      return;
    }

    setBulkAssignSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedTag = tags.find((tag) => tag.id === bulkAssignTagId);
      if (!selectedTag) {
        throw new Error('Selected tag no longer exists.');
      }
      if (selectedTag.workspaceId && selectedTag.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(selectedTag.workspaceId);
        setActiveWorkspaceId(selectedTag.workspaceId);
      }

      let assignedCount = 0;
      let skippedCount = 0;
      for (const creative of selectedCreatives) {
        const version = latestVersions[creative.id];
        if (!version) {
          skippedCount += 1;
          continue;
        }
        await assignCreativeVersionToTag({
          creativeVersionId: version.id,
          tagId: bulkAssignTagId,
        });
        assignedCount += 1;
      }

      setSelectedCreativeIds([]);
      setBulkAssignTagId('');
      const suffix = skippedCount ? ` ${skippedCount} creative${skippedCount === 1 ? '' : 's'} skipped because they had no latest version.` : '';
      setSuccessMessage(`Assigned ${assignedCount} creative${assignedCount === 1 ? '' : 's'} to "${selectedTag.name}".${suffix}`);
      window.setTimeout(() => setSuccessMessage(''), 4000);
    } catch (assignError: any) {
      setError(assignError.message ?? 'Failed to assign creatives to tag');
    } finally {
      setWorkspaceBusy(false);
      setBulkAssignSaving(false);
    }
  };

  const handleBulkCreateSizeTag = async (name: string) => {
    const normalizedName = name.trim();
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    if (!normalizedName) {
      setError('Name the tag before creating it.');
      return;
    }
    if (selectedCreativeWorkspaceIds.length !== 1) {
      setError('Create tag from selection only works when all selected creatives belong to one client.');
      return;
    }

    const selectedVersions = selectedCreatives
      .map((creative) => latestVersions[creative.id])
      .filter((version): version is CreativeVersion => Boolean(version));
    if (selectedVersions.length !== selectedCreatives.length) {
      setError('Every selected creative needs a latest version before creating a tag.');
      return;
    }

    const displayVersions = selectedVersions.filter((version) => (
      ['display_html', 'display_image'].includes(String(version.servingFormat))
    ));
    if (displayVersions.length !== selectedVersions.length) {
      setError('Create tag from selection supports display creatives only.');
      return;
    }

    const sizeKeys = new Set(displayVersions.map((version) => {
      const width = Number(version.width) || 0;
      const height = Number(version.height) || 0;
      return width > 0 && height > 0 ? `${width}x${height}` : '';
    }));
    sizeKeys.delete('');
    if (sizeKeys.size !== 1) {
      setError('Select creatives with one exact size only before creating a tag.');
      return;
    }

    const [width, height] = Array.from(sizeKeys)[0].split('x').map(Number);
    const workspaceId = selectedCreativeWorkspaceIds[0];

    setBulkCreateTagSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      if (workspaceId && workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(workspaceId);
        setActiveWorkspaceId(workspaceId);
      }

      const createdTag = await createTag({
        workspaceId,
        name: normalizedName,
        format: 'display',
        status: 'draft',
        servingWidth: width,
        servingHeight: height,
      });
      if (!createdTag) {
        throw new Error('Tag creation did not return a tag.');
      }

      for (const version of displayVersions) {
        await assignCreativeVersionToTag({
          creativeVersionId: version.id,
          tagId: createdTag.id,
        });
      }

      await load();
      setSelectedCreativeIds([]);
      setBulkAssignTagId('');
      setSuccessMessage(
        `Created tag "${createdTag.name}" (${width}x${height}) with ${displayVersions.length} creative${displayVersions.length === 1 ? '' : 's'} assigned.`,
      );
      window.setTimeout(() => setSuccessMessage(''), 4500);
    } catch (createError: any) {
      setError(createError.message ?? 'Failed to create tag from selected creatives.');
    } finally {
      setWorkspaceBusy(false);
      setBulkCreateTagSaving(false);
    }
  };

  const handleBulkCreativeStatusUpdate = async (nextStatus: 'draft' | 'archived') => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }

    setBulkStatusSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
      let updatedCount = 0;
      let skippedCount = 0;

      for (const creative of selectedCreatives) {
        const version = latestVersions[creative.id];
        if (!version) {
          skippedCount += 1;
          continue;
        }
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        const response = await updateCreativeVersionById({
          creativeVersionId: version.id,
          status: nextStatus,
        });
        setLatestVersions((current) => ({
          ...current,
          [creative.id]: response.creativeVersion,
        }));
        updatedCount += 1;
      }

      setSelectedCreativeIds([]);
      const suffix = skippedCount ? ` ${skippedCount} creative${skippedCount === 1 ? '' : 's'} skipped because they had no latest version.` : '';
      setSuccessMessage(`${nextStatus === 'draft' ? 'Activated' : 'Deactivated'} ${updatedCount} creative${updatedCount === 1 ? '' : 's'}.${suffix}`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update selected creatives.');
    } finally {
      setWorkspaceBusy(false);
      setBulkStatusSaving(false);
    }
  };

  const handleBulkDeleteCreatives = async () => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
    if (!(await confirm({
      title: `Delete ${selectedCreatives.length} selected creative${selectedCreatives.length === 1 ? '' : 's'}?`,
      description: 'This will remove published versions and assignments.',
      tone: 'danger',
      confirmLabel: 'Delete selected',
    }))) {
      return;
    }

    setBulkDeleteSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      for (const creative of selectedCreatives) {
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        await deleteCreativeById(creative.id);
      }
      await load();
      setSelectedCreativeIds([]);
      setSuccessMessage(`Deleted ${selectedCreatives.length} creative${selectedCreatives.length === 1 ? '' : 's'}.`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (deleteError: any) {
      setError(deleteError.message ?? 'Failed to delete selected creatives.');
    } finally {
      setWorkspaceBusy(false);
      setBulkDeleteSaving(false);
    }
  };

  const handleCreativeOperationalStatusToggle = async (
    creative: Creative,
    getCreativeOperationalState: (creative: Creative) => string,
  ) => {
    const version = latestVersions[creative.id];
    if (!version) {
      setError('This creative does not have a latest version yet.');
      return;
    }

    const nextStatus = getCreativeOperationalState(creative) === 'inactive' ? 'draft' : 'archived';

    setStatusUpdateCreativeId(creative.id);
    setError('');
    setSuccessMessage('');
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      const response = await updateCreativeVersionById({
        creativeVersionId: version.id,
        status: nextStatus,
      });
      setLatestVersions((current) => ({
        ...current,
        [creative.id]: response.creativeVersion,
      }));
      setSuccessMessage(
        `${creative.name} is now ${nextStatus === 'draft' ? 'live' : 'inactive'}.`,
      );
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update creative status');
    } finally {
      setWorkspaceBusy(false);
      setStatusUpdateCreativeId('');
    }
  };

  return {
    clickUrlEditor,
    setClickUrlEditor,
    bulkClickUrlSaving,
    bulkAssignSaving,
    bulkCreateTagSaving,
    bulkStatusSaving,
    bulkDeleteSaving,
    statusUpdateCreativeId,
    handleDeleteCreative,
    handleBulkClickUrlUpdate,
    handleEditCreativeClickUrl,
    handleSaveCreativeClickUrl,
    handleBulkAssignToTag,
    handleBulkCreateSizeTag,
    handleBulkCreativeStatusUpdate,
    handleBulkDeleteCreatives,
    handleCreativeOperationalStatusToggle,
  };
}

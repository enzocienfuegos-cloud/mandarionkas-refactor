import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { DropdownMenu, type DropdownMenuEntry } from '../primitives/DropdownMenu';
import { Input } from '../primitives/Input';
import { Modal } from '../primitives/Modal';
import { useConfirm } from '../feedback/Confirm';
import { useToast } from '../feedback/Toast';
import { CheckCircle2, Copy, LinkIcon, Save, SlidersHorizontal, Trash2 } from '../icons';
import {
  buildSavedViewUrl,
  createSavedView,
  deleteSavedView,
  listSavedViews,
  updateSavedView,
  type SavedView,
} from '../../shared/saved-views';

export interface SavedViewsMenuProps {
  surface: string;
  currentFilters: Record<string, unknown>;
  currentSort?: Record<string, unknown> | null;
  currentColumns?: string[];
  currentViewId?: string | null;
  onApplyView: (view: SavedView) => void;
  onClearView?: () => void;
}

export function SavedViewsMenu({
  surface,
  currentFilters,
  currentSort = null,
  currentColumns = [],
  currentViewId = null,
  onApplyView,
  onClearView,
}: SavedViewsMenuProps) {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveShared, setSaveShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadViews = useCallback(async () => {
    setLoading(true);
    try {
      const nextViews = await listSavedViews(surface);
      setViews(nextViews);
    } catch (error) {
      toast({
        tone: 'critical',
        title: error instanceof Error ? error.message : 'Couldn’t load saved views.',
      });
    } finally {
      setLoading(false);
    }
  }, [surface, toast]);

  useEffect(() => {
    void loadViews();
  }, [loadViews]);

  const currentView = useMemo(
    () => views.find((view) => view.id === currentViewId) ?? null,
    [views, currentViewId],
  );
  const currentViewCanUpdate = Boolean(currentView?.canDelete);

  const closeSaveModal = useCallback(() => {
    setSaveOpen(false);
    setSaveName('');
    setSaveShared(false);
  }, []);

  const handleSaveCurrentView = useCallback(async () => {
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      toast({ tone: 'warning', title: 'Add a name before saving this view.' });
      return;
    }

    setSaving(true);
    try {
      const view = currentView && currentView.canDelete && trimmedName === currentView.name
        ? await updateSavedView(currentView.id, {
            name: trimmedName,
            filters: currentFilters,
            sort: currentSort,
            columns: currentColumns,
            isShared: saveShared,
          })
        : await createSavedView({
            surface,
            name: trimmedName,
            filters: currentFilters,
            sort: currentSort,
            columns: currentColumns,
            isShared: saveShared,
          });
      if (!view) throw new Error('Couldn’t save this view.');
      setViews((current) => [view, ...current.filter((entry) => entry.id !== view.id)]);
      onApplyView(view);
      closeSaveModal();
      toast({
        tone: 'success',
        title: currentView && currentView.canDelete && trimmedName === currentView.name
          ? `Updated view "${view.name}".`
          : saveShared
            ? `Saved shared view "${view.name}".`
            : `Saved view "${view.name}".`,
      });
    } catch (error) {
      toast({
        tone: 'critical',
        title: error instanceof Error ? error.message : 'Couldn’t save this view.',
      });
    } finally {
      setSaving(false);
    }
  }, [closeSaveModal, currentColumns, currentFilters, currentSort, currentView, onApplyView, saveName, saveShared, surface, toast]);

  const handleSaveAsNew = useCallback(async () => {
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      toast({ tone: 'warning', title: 'Add a name before saving this view.' });
      return;
    }

    setSaving(true);
    try {
      const view = await createSavedView({
        surface,
        name: trimmedName,
        filters: currentFilters,
        sort: currentSort,
        columns: currentColumns,
        isShared: saveShared,
      });
      if (!view) throw new Error('Couldn’t save this view.');
      setViews((current) => [view, ...current.filter((entry) => entry.id !== view.id)]);
      onApplyView(view);
      closeSaveModal();
      toast({
        tone: 'success',
        title: saveShared
          ? `Saved shared view "${view.name}".`
          : `Saved view "${view.name}".`,
      });
    } catch (error) {
      toast({
        tone: 'critical',
        title: error instanceof Error ? error.message : 'Couldn’t save this view.',
      });
    } finally {
      setSaving(false);
    }
  }, [closeSaveModal, currentColumns, currentFilters, currentSort, onApplyView, saveName, saveShared, surface, toast]);

  const handleCopyShareLink = useCallback(async () => {
    if (!currentViewId) return;
    const url = buildSavedViewUrl(currentViewId);
    try {
      await navigator.clipboard.writeText(url);
      toast({ tone: 'success', title: 'Saved view link copied.' });
    } catch {
      toast({ tone: 'critical', title: 'Couldn’t copy the saved view link.' });
    }
  }, [currentViewId, toast]);

  const handleDeleteCurrentView = useCallback(async () => {
    if (!currentView) return;
    const approved = await confirm({
      title: `Delete saved view "${currentView.name}"?`,
      description: 'This removes the saved filter preset for your workspace.',
      tone: 'danger',
      confirmLabel: 'Delete view',
    });
    if (!approved) return;

    try {
      await deleteSavedView(currentView.id);
      setViews((items) => items.filter((view) => view.id !== currentView.id));
      onClearView?.();
      toast({ tone: 'warning', title: `Deleted saved view "${currentView.name}".` });
    } catch (error) {
      toast({
        tone: 'critical',
        title: error instanceof Error ? error.message : 'Couldn’t delete this saved view.',
      });
    }
  }, [confirm, currentView, onClearView, toast]);

  const items = useMemo<DropdownMenuEntry[]>(() => {
    const entries: DropdownMenuEntry[] = [
      { type: 'label', text: 'Saved views' },
    ];

    if (loading) {
      entries.push({ type: 'label', text: 'Loading views…' });
    } else if (!views.length) {
      entries.push({ type: 'label', text: 'No saved views yet' });
    } else {
      for (const view of views) {
        entries.push({
          id: `apply-${view.id}`,
          label: view.name,
          icon: currentViewId === view.id ? <CheckCircle2 /> : <LinkIcon />,
          shortcut: view.isShared ? 'Shared' : undefined,
          onSelect: () => onApplyView(view),
        });
      }
    }

    entries.push({ type: 'separator' });
    entries.push({
      id: 'save-current-view',
      label: 'Save current view',
      icon: <Save />,
      onSelect: () => {
        setSaveName(currentView?.name ?? '');
        setSaveShared(currentView?.isShared ?? false);
        setSaveOpen(true);
      },
    });
    entries.push({
      id: 'copy-share-link',
      label: 'Copy share link',
      icon: <Copy />,
      disabled: !currentViewId,
      onSelect: () => {
        void handleCopyShareLink();
      },
    });
    entries.push({
      id: 'delete-current-view',
      label: 'Delete current view',
      icon: <Trash2 />,
      danger: true,
      disabled: !currentView?.canDelete,
      onSelect: () => {
        void handleDeleteCurrentView();
      },
    });
    return entries;
  }, [currentView, currentViewId, handleCopyShareLink, handleDeleteCurrentView, loading, onApplyView, views]);

  return (
    <>
      <DropdownMenu
        trigger={(
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<SlidersHorizontal />}
          >
            {currentView ? currentView.name : 'Saved views'}
          </Button>
        )}
        items={items}
      />

      <Modal
        open={saveOpen}
        onClose={() => {
          if (saving) return;
          closeSaveModal();
        }}
        title="Save current view"
        description="Store these filters and share the exact operational slice with your team."
        size="sm"
        footer={(
          <>
            <Button variant="ghost" onClick={closeSaveModal} disabled={saving}>
              Cancel
            </Button>
            {currentViewCanUpdate ? (
              <>
                <Button variant="secondary" onClick={() => void handleSaveAsNew()} loading={saving}>
                  Save as new
                </Button>
                <Button variant="primary" onClick={() => void handleSaveCurrentView()} loading={saving}>
                  Update "{currentView?.name}"
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => void handleSaveCurrentView()} loading={saving}>
                Save view
              </Button>
            )}
          </>
        )}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary" htmlFor="saved-view-name">
              View name
            </label>
            <Input
              id="saved-view-name"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              maxLength={120}
              placeholder="e.g. Bancoagrícola exceptions only"
            />
            <p className="text-xs text-text-muted">
              {saveName.length}/120 characters
            </p>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border-default bg-surface-2 p-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Visibility</p>
              <p className="mt-1 text-xs text-text-muted">
                Shared views can be opened by teammates in the same workspace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={saveShared ? 'ghost' : 'secondary'}
                onClick={() => setSaveShared(false)}
              >
                Private
              </Button>
              <Button
                size="sm"
                variant={saveShared ? 'secondary' : 'ghost'}
                onClick={() => setSaveShared(true)}
              >
                Shared
              </Button>
            </div>
          </div>

          {currentView ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>Updating around current scope:</span>
              <Badge tone={currentView.isShared ? 'info' : 'neutral'} size="sm">
                {currentView.isShared ? 'Shared view' : 'Private view'}
              </Badge>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

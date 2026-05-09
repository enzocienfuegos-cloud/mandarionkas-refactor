import { useEffect, useMemo, useState } from 'react';
import { applyBrandKitToDocument } from '../../../domain/brand-kit/apply-to-document';
import type { BrandKit, BrandKitDraft } from '../../../domain/brand-kit/types';
import type { StudioDocument } from '../../../domain/document/types';
import { useStudioSessionActions } from '../../../hooks/use-studio-actions';
import { usePlatformPermission, usePlatformSnapshot } from '../../../platform/runtime';
import { deleteBrandKit, listBrandKits, saveBrandKit } from '../../../repositories/brand-kit';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { useToast } from '../../../shared/ui/ToastProvider';

function cloneDraft(input: BrandKitDraft): BrandKitDraft {
  return {
    name: input.name,
    description: input.description,
    brandId: input.brandId,
    brandName: input.brandName,
    colors: { ...(input.colors ?? {}) },
    typography: { ...(input.typography ?? {}) },
    radii: { ...(input.radii ?? {}) },
    motion: { ...(input.motion ?? {}) },
    logos: { ...(input.logos ?? {}) },
  };
}

function buildDraftFromBrandKit(brandKit: BrandKit): BrandKitDraft {
  return {
    name: brandKit.name,
    description: brandKit.description,
    brandId: brandKit.brandId,
    brandName: brandKit.brandName,
    colors: { ...(brandKit.colors ?? {}) },
    typography: { ...(brandKit.typography ?? {}) },
    radii: { ...(brandKit.radii ?? {}) },
    motion: { ...(brandKit.motion ?? {}) },
    logos: { ...(brandKit.logos ?? {}) },
  };
}

function buildDraftFromDocument(document: StudioDocument, fallbackName?: string): BrandKitDraft {
  return {
    name: document.metadata.platform?.brandKitName ?? document.metadata.platform?.brandName ?? fallbackName ?? 'Untitled Brand Kit',
    brandId: document.metadata.platform?.brandId,
    brandName: document.metadata.platform?.brandName,
    colors: {
      background: document.canvas.backgroundColor,
    },
    typography: {},
    radii: {},
    motion: {},
    logos: {},
  };
}

type ApplyMode = 'replace' | 'merge';

export type BrandKitController = {
  brandKits: BrandKit[];
  selectedBrandKitId: string;
  selectedBrandKit?: BrandKit;
  activeBrandKitId?: string;
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  canManageBrandkits: boolean;
  errorMessage?: string;
  draft: BrandKitDraft;
  setSelectedBrandKitId(value: string): void;
  updateDraft(patch: Partial<BrandKitDraft>): void;
  updateDraftColors(patch: NonNullable<BrandKitDraft['colors']>): void;
  updateDraftTypography(patch: NonNullable<BrandKitDraft['typography']>): void;
  updateDraftRadii(patch: NonNullable<BrandKitDraft['radii']>): void;
  refresh(): Promise<void>;
  startNewDraft(): void;
  applySelectedBrandKit(mode?: ApplyMode): void;
  persistDraft(): Promise<void>;
  removeSelectedBrandKit(): Promise<void>;
};

export function useBrandKitController(): BrandKitController {
  const state = useStudioStore((value) => value);
  const { replaceState } = useStudioSessionActions();
  const platform = usePlatformSnapshot();
  const { pushToast } = useToast();
  const canManageBrandkits = usePlatformPermission('brandkits:manage');
  const [brandKitsState, setBrandKitsState] = useState<BrandKit[]>([]);
  const [selectedBrandKitId, setSelectedBrandKitId] = useState('');
  const [draft, setDraft] = useState<BrandKitDraft>(() => buildDraftFromDocument(state.document));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const activeBrandKitId = state.document.metadata.platform?.brandKitId;
  const selectedBrandKit = useMemo(
    () => brandKitsState.find((item) => item.id === selectedBrandKitId),
    [brandKitsState, selectedBrandKitId],
  );

  async function refresh(): Promise<void> {
    setLoading(true);
    setErrorMessage(undefined);
    try {
      const nextBrandKits = await listBrandKits();
      setBrandKitsState(nextBrandKits);
      setSelectedBrandKitId((current) => {
        if (current && nextBrandKits.some((item) => item.id === current)) return current;
        if (activeBrandKitId && nextBrandKits.some((item) => item.id === activeBrandKitId)) return activeBrandKitId;
        return nextBrandKits[0]?.id ?? '';
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load Brand Kits.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (selectedBrandKit) {
      setDraft(cloneDraft(buildDraftFromBrandKit(selectedBrandKit)));
      return;
    }
    if (!selectedBrandKitId) {
      setDraft(cloneDraft(buildDraftFromDocument(
        state.document,
        platform.clients.find((client) => client.id === platform.session.activeClientId)?.name,
      )));
    }
  }, [platform.clients, platform.session.activeClientId, selectedBrandKit, selectedBrandKitId, state.document]);

  function updateDraft(patch: Partial<BrandKitDraft>): void {
    setDraft((current) => cloneDraft({ ...current, ...patch }));
  }

  function updateDraftColors(patch: NonNullable<BrandKitDraft['colors']>): void {
    setDraft((current) => cloneDraft({ ...current, colors: { ...(current.colors ?? {}), ...patch } }));
  }

  function updateDraftTypography(patch: NonNullable<BrandKitDraft['typography']>): void {
    setDraft((current) => cloneDraft({ ...current, typography: { ...(current.typography ?? {}), ...patch } }));
  }

  function updateDraftRadii(patch: NonNullable<BrandKitDraft['radii']>): void {
    setDraft((current) => cloneDraft({ ...current, radii: { ...(current.radii ?? {}), ...patch } }));
  }

  function startNewDraft(): void {
    setSelectedBrandKitId('');
    setDraft(cloneDraft(buildDraftFromDocument(
      state.document,
      platform.clients.find((client) => client.id === platform.session.activeClientId)?.name,
    )));
  }

  function applySelectedBrandKit(mode: ApplyMode = 'replace'): void {
    if (!selectedBrandKit) {
      pushToast({
        title: 'No Brand Kit selected',
        description: 'Choose a Brand Kit before applying it to the document.',
        tone: 'info',
      });
      return;
    }
    const nextDocument = applyBrandKitToDocument(state.document, selectedBrandKit, { mode });
    replaceState({
      ...state,
      document: nextDocument,
    });
    pushToast({
      title: 'Brand Kit applied',
      description: `${selectedBrandKit.name} was applied in ${mode} mode.`,
      tone: 'success',
    });
  }

  async function persistDraft(): Promise<void> {
    if (!canManageBrandkits) return;
    setSaving(true);
    setErrorMessage(undefined);
    try {
      const saved = await saveBrandKit(draft, selectedBrandKit?.id);
      await refresh();
      setSelectedBrandKitId(saved.id);
      pushToast({
        title: selectedBrandKit ? 'Brand Kit updated' : 'Brand Kit created',
        description: `${saved.name} is ready to use.`,
        tone: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the Brand Kit.';
      setErrorMessage(message);
      pushToast({
        title: 'Brand Kit save failed',
        description: message,
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeSelectedBrandKit(): Promise<void> {
    if (!canManageBrandkits || !selectedBrandKit) return;
    setDeleting(true);
    setErrorMessage(undefined);
    try {
      await deleteBrandKit(selectedBrandKit.id);
      pushToast({
        title: 'Brand Kit removed',
        description: `${selectedBrandKit.name} was deleted.`,
        tone: 'success',
      });
      setSelectedBrandKitId('');
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete the Brand Kit.';
      setErrorMessage(message);
      pushToast({
        title: 'Delete failed',
        description: message,
        tone: 'danger',
      });
    } finally {
      setDeleting(false);
    }
  }

  return {
    brandKits: brandKitsState,
    selectedBrandKitId,
    selectedBrandKit,
    activeBrandKitId,
    loading,
    saving,
    deleting,
    canManageBrandkits,
    errorMessage,
    draft,
    setSelectedBrandKitId,
    updateDraft,
    updateDraftColors,
    updateDraftTypography,
    updateDraftRadii,
    refresh,
    startNewDraft,
    applySelectedBrandKit,
    persistDraft,
    removeSelectedBrandKit,
  };
}

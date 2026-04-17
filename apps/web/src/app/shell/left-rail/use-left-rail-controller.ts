import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { getWidgetDefinition, listWidgetDefinitions } from '../../../widgets/registry/widget-registry';
import { ingestAssetFile, ingestAssetUrl, listAssets, removeAsset, renameAsset, reprocessAsset, updateAssetQuality } from '../../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../../repositories/asset/events';
import { usePlatformActions, usePlatformPermission } from '../../../platform/runtime';
import { useSceneActions, useUiActions, useWidgetActions } from '../../../hooks/use-studio-actions';
import { resolveAssetDeliveryUrl } from '../../../assets/policy';
import type { AssetKind, AssetProcessingStatus, AssetQualityPreference, AssetRecord } from '../../../assets/types';
import { resolveFontAssetFamily } from '../../../assets/font-family';

export const CATEGORY_ORDER = ['content', 'media', 'interactive', 'layout'] as const;
export type CategoryFilter = 'all' | (typeof CATEGORY_ORDER)[number];
export type AssetFilter = 'all' | AssetKind;
export type AssetSort = 'recent' | 'name' | 'size';
// Shared processing states for both image-derivative and video-transcode jobs.
const PROCESSING_STATUSES: AssetProcessingStatus[] = ['queued', 'processing', 'planned'];

function sortAssets(assets: AssetRecord[], mode: AssetSort): AssetRecord[] {
  const sorted = [...assets];
  if (mode === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (mode === 'size') return sorted.sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0));
  return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function useLeftRailController() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [assetQuery, setAssetQuery] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const [assetSort, setAssetSort] = useState<AssetSort>('recent');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetScope, setAssetScope] = useState<'client' | 'private'>('client');
  const [assetTick, setAssetTick] = useState(0);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetError, setAssetError] = useState('');
  const [assetStatusMessage, setAssetStatusMessage] = useState('');
  const [assetUploadProgress, setAssetUploadProgress] = useState(0);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const widgets = listWidgetDefinitions();
  const sceneActions = useSceneActions();
  const widgetActions = useWidgetActions();
  const uiActions = useUiActions();
  const platform = usePlatformActions();
  const canCreateAssets = usePlatformPermission('assets:create');
  const canDeleteAssets = usePlatformPermission('assets:delete');
  const canUpdateAssets = usePlatformPermission('assets:update');
  const isAuthenticated = platform.state.session.isAuthenticated;
  const sessionId = platform.state.session.sessionId;
  const activeClientId = platform.state.session.activeClientId;
  const activeClient = platform.state.clients.find((client) => client.id === activeClientId);
  const { scene, scenes, layerIds, selectedIds, nodes, activeSceneId, openComments, pendingApprovals, activeLeftTab, primaryWidget, targetChannel } = useStudioStore((state) => {
    const scene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId)
      ?? state.document.scenes[0];
    return {
      scene,
      scenes: state.document.scenes,
      activeSceneId: state.document.selection.activeSceneId,
      layerIds: [...scene.widgetIds].reverse(),
      selectedIds: state.document.selection.widgetIds,
      nodes: state.document.widgets,
      primaryWidget: state.document.selection.primaryWidgetId ? state.document.widgets[state.document.selection.primaryWidgetId] : undefined,
      openComments: state.document.collaboration.comments.filter((item) => item.status === 'open').length,
      pendingApprovals: state.document.collaboration.approvals.filter((item) => item.status === 'pending').length,
      activeLeftTab: state.ui.activeLeftTab,
      targetChannel: state.document.metadata.release.targetChannel,
    };
  });

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || !sessionId) {
      setAssets([]);
      setSelectedAssetId('');
      return () => {
        cancelled = true;
      };
    }

    const syncAssets = () => {
      void listAssets()
        .then((records) => {
          if (!cancelled) setAssets(records);
        })
        .catch(() => {
          if (!cancelled) setAssets([]);
        });
    };

    syncAssets();
    const unsubscribe = subscribeToAssetLibraryChanges(syncAssets);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [assetTick, activeClientId, isAuthenticated, sessionId]);

  const hasProcessingAssets = useMemo(
    () => assets.some((asset) => asset.processingStatus && PROCESSING_STATUSES.includes(asset.processingStatus)),
    [assets],
  );

  useEffect(() => {
    if (!hasProcessingAssets || !isAuthenticated || !sessionId) return undefined;
    const timer = window.setInterval(() => {
      void listAssets()
        .then((records) => setAssets(records))
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasProcessingAssets, isAuthenticated, sessionId]);

  const filteredWidgets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return widgets.filter((widget) => {
      const matchesCategory = category === 'all' || widget.category === category;
      const matchesQuery = !normalized || `${widget.label} ${widget.type} ${widget.category}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [widgets, category, query]);

  const filteredAssets = useMemo(() => {
    const normalized = assetQuery.trim().toLowerCase();
    return sortAssets(assets.filter((asset) => {
      const matchesKind = assetFilter === 'all' || asset.kind === assetFilter;
      const matchesText = !normalized || `${asset.name} ${asset.kind} ${(asset.tags ?? []).join(' ')}`.toLowerCase().includes(normalized);
      return matchesKind && matchesText;
    }), assetSort);
  }, [assets, assetFilter, assetQuery, assetSort]);

  const assetCounts = useMemo(() => ({
    all: assets.length,
    image: assets.filter((asset) => asset.kind === 'image').length,
    video: assets.filter((asset) => asset.kind === 'video').length,
    font: assets.filter((asset) => asset.kind === 'font').length,
    other: assets.filter((asset) => asset.kind === 'other').length,
    processing: assets.filter((asset) => asset.processingStatus && PROCESSING_STATUSES.includes(asset.processingStatus)).length,
  }), [assets]);

  const selectedAsset = useMemo(() => {
    const preferred = filteredAssets.find((asset) => asset.id === selectedAssetId) ?? assets.find((asset) => asset.id === selectedAssetId);
    return preferred ?? filteredAssets[0] ?? assets[0];
  }, [assets, filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (!selectedAssetId && selectedAsset?.id) setSelectedAssetId(selectedAsset.id);
  }, [selectedAssetId, selectedAsset]);

  const selectedAssetQuality = selectedAsset?.qualityPreference ?? 'auto';

  function getAssetQualityPreference(asset?: AssetRecord): AssetQualityPreference {
    if (!asset) return 'auto';
    return asset.qualityPreference ?? 'auto';
  }

  async function setAssetQualityPreference(assetId: string, qualityPreference: AssetQualityPreference): Promise<void> {
    setAssets((current) => current.map((asset) => (
      asset.id === assetId ? { ...asset, qualityPreference } : asset
    )));
    try {
      await updateAssetQuality(assetId, qualityPreference);
      refreshAssets();
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : 'Could not update asset quality.');
      refreshAssets();
    }
  }

  function resolveAssetPreviewUrl(asset: AssetRecord): string {
    return resolveAssetDeliveryUrl(asset, targetChannel, getAssetQualityPreference(asset));
  }

  const counts = useMemo(() => CATEGORY_ORDER.reduce<Record<string, number>>((acc, item) => {
    acc[item] = widgets.filter((widget) => widget.category === item).length;
    return acc;
  }, {}), [widgets]);

  function refreshAssets(): void {
    setAssetTick((value) => value + 1);
  }

  async function addAssetFromUrl(): Promise<void> {
    return addAssetFromUrlToFolder();
  }

  async function addAssetFromUrlToFolder(folderId?: string): Promise<void> {
    if (!canCreateAssets || !assetUrl.trim()) return;
    setAssetBusy(true);
    setAssetError('');
    try {
      const asset = await ingestAssetUrl({
        url: assetUrl.trim(),
        name: assetName.trim() || assetUrl.split('/').pop() || 'Remote asset',
        accessScope: assetScope,
        folderId,
      });
      setAssetUrl('');
      setAssetName('');
      setSelectedAssetId(asset.id);
      refreshAssets();
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : 'Could not add remote asset.');
    } finally {
      setAssetBusy(false);
    }
  }

  function handleFileUpload(file: File, folderId?: string): void {
    if (!canCreateAssets) return;
    setAssetBusy(true);
    setAssetError('');
    setAssetStatusMessage(`Uploading ${file.name}...`);
    setAssetUploadProgress(0);
    void ingestAssetFile({
      file,
      name: file.name,
      accessScope: assetScope,
      folderId,
      onProgress: (progress) => {
        setAssetUploadProgress(progress.percentage);
        setAssetStatusMessage(`Uploading ${file.name}... ${progress.percentage}%`);
      },
    }).then((asset) => {
      setSelectedAssetId(asset.id);
      setAssetUploadProgress(100);
      setAssetStatusMessage(`${asset.name} uploaded successfully.`);
      refreshAssets();
    }).catch((error) => {
      setAssetError(error instanceof Error ? error.message : 'Could not upload asset.');
      setAssetStatusMessage('');
    }).finally(() => {
      setAssetBusy(false);
    });
  }

  function handleFilesUpload(files: FileList | File[], folderId?: string): void {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;
    void (async () => {
      for (let index = 0; index < nextFiles.length; index += 1) {
        const file = nextFiles[index];
        setAssetStatusMessage(`Uploading ${file.name} (${index + 1}/${nextFiles.length})...`);
        await new Promise<void>((resolve) => {
          setAssetBusy(true);
          setAssetError('');
          setAssetUploadProgress(0);
          void ingestAssetFile({
            file,
            name: file.name,
            accessScope: assetScope,
            folderId,
            onProgress: (progress) => {
              setAssetUploadProgress(progress.percentage);
              setAssetStatusMessage(`Uploading ${file.name} (${index + 1}/${nextFiles.length})... ${progress.percentage}%`);
            },
          }).then((asset) => {
            setSelectedAssetId(asset.id);
            setAssetUploadProgress(100);
            setAssetStatusMessage(`${asset.name} uploaded successfully.`);
            refreshAssets();
          }).catch((error) => {
            setAssetError(error instanceof Error ? error.message : `Could not upload ${file.name}.`);
          }).finally(() => {
            setAssetBusy(false);
            resolve();
          });
        });
      }
    })();
  }

  function assignAsset(asset: AssetRecord): void {
    if (!primaryWidget) return;
    const resolvedSrc = resolveAssetDeliveryUrl(asset, targetChannel, getAssetQualityPreference(asset));
    if (primaryWidget.type === 'image' || primaryWidget.type === 'hero-image') {
      if (asset.kind !== 'image') return;
      widgetActions.updateWidgetProps(primaryWidget.id, {
        src: resolvedSrc,
        assetId: asset.id,
        assetQualityPreference: getAssetQualityPreference(asset),
        alt: asset.name,
      });
      return;
    }
    if (primaryWidget.type === 'video-hero') {
      if (asset.kind !== 'video') return;
      widgetActions.updateWidgetProps(primaryWidget.id, {
        src: resolvedSrc,
        assetId: asset.id,
        assetQualityPreference: getAssetQualityPreference(asset),
        posterSrc: asset.derivatives?.poster?.src ?? asset.posterSrc ?? primaryWidget.props.posterSrc,
      });
      return;
    }
    if (['text', 'cta', 'badge'].includes(primaryWidget.type)) {
      if (asset.kind !== 'font') return;
      widgetActions.updateWidgetProps(primaryWidget.id, { fontAssetId: asset.id, fontAssetSrc: asset.src });
      widgetActions.updateWidgetStyle(primaryWidget.id, { fontFamily: resolveFontAssetFamily(asset) });
    }
  }

  async function deleteAsset(assetId: string): Promise<void> {
    await removeAsset(assetId);
    if (selectedAssetId === assetId) setSelectedAssetId('');
    refreshAssets();
  }

  async function renameSelectedAsset(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!selectedAsset?.id || !trimmed || !canUpdateAssets) return;
    await renameAsset(selectedAsset.id, trimmed);
    refreshAssets();
  }

  async function reprocessSelectedAsset(): Promise<void> {
    if (!selectedAsset?.id || !canUpdateAssets) return;
    setAssetBusy(true);
    setAssetError('');
    try {
      await reprocessAsset(selectedAsset.id);
      refreshAssets();
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : 'Could not retry asset processing.');
    } finally {
      setAssetBusy(false);
    }
  }

  const selectedWidgetAcceptsAsset = primaryWidget && ['image', 'hero-image', 'video-hero', 'text', 'cta', 'badge'].includes(primaryWidget.type);

  return {
    query,
    setQuery,
    category,
    setCategory,
    assetQuery,
    setAssetQuery,
    assetFilter,
    setAssetFilter,
    assetSort,
    setAssetSort,
    assetUrl,
    setAssetUrl,
    assetName,
    setAssetName,
    assetScope,
    setAssetScope,
    assets,
    assetCounts,
    assetBusy,
    assetError,
    assetStatusMessage,
    assetUploadProgress,
    filteredAssets,
    selectedAsset,
    selectedAssetQuality,
    selectedAssetId,
    setSelectedAssetId,
    widgets,
    filteredWidgets,
    counts,
    fileInputRef,
    sceneActions,
    widgetActions,
    activeClient,
    scene,
    scenes,
    layerIds,
    selectedIds,
    nodes,
    activeSceneId,
    openComments,
    pendingApprovals,
    activeLeftTab,
    primaryWidget,
    selectedWidgetAcceptsAsset,
    canCreateAssets,
    canDeleteAssets,
    canUpdateAssets,
    addAssetFromUrl,
    addAssetFromUrlToFolder,
    handleFileUpload,
    handleFilesUpload,
    assignAsset,
    getAssetQualityPreference,
    setAssetQualityPreference,
    resolveAssetPreviewUrl,
    refreshAssets,
    deleteAsset,
    renameSelectedAsset,
    reprocessSelectedAsset,
    getWidgetDefinition,
    targetChannel,
    setActiveLeftTab: uiActions.setLeftTab,
  };
}

export type LeftRailController = ReturnType<typeof useLeftRailController>;

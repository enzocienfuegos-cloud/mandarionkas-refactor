import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlatformActions, usePlatformPermission } from '../../../platform/runtime';
import { resolveAssetPreviewUrl as resolveAssetPreviewImageUrl } from '../../../assets/policy';
import type { AssetKind, AssetProcessingStatus, AssetQualityPreference, AssetRecord } from '../../../assets/types';
import { ingestAssetFile, ingestAssetUrl, listAssets, removeAsset, renameAsset, reprocessAsset, updateAssetQuality } from '../../../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../../../repositories/asset/events';
import { widgetAcceptsAssetSwap } from './asset-controller-helpers';
import { assignAssetToWidget, sortAssets } from './asset-controller-helpers';
import type { ReleaseTarget, WidgetNode } from '../../../domain/document/types';
import type { useWidgetActions } from '../../../hooks/use-studio-actions';

export type AssetFilter = 'all' | AssetKind;
export type AssetSort = 'recent' | 'name' | 'size';

type LeftRailAssetsOptions = {
  primaryWidget: WidgetNode | undefined;
  targetChannel: ReleaseTarget;
  widgetActions: ReturnType<typeof useWidgetActions>;
};

export type LeftRailAssetsState = {
  assetQuery: string;
  setAssetQuery: React.Dispatch<React.SetStateAction<string>>;
  assetFilter: AssetFilter;
  setAssetFilter: React.Dispatch<React.SetStateAction<AssetFilter>>;
  assetSort: AssetSort;
  setAssetSort: React.Dispatch<React.SetStateAction<AssetSort>>;
  assetUrl: string;
  setAssetUrl: React.Dispatch<React.SetStateAction<string>>;
  assetName: string;
  setAssetName: React.Dispatch<React.SetStateAction<string>>;
  assetScope: 'client' | 'private';
  setAssetScope: React.Dispatch<React.SetStateAction<'client' | 'private'>>;
  assets: AssetRecord[];
  assetCounts: {
    all: number;
    image: number;
    video: number;
    font: number;
    other: number;
    processing: number;
  };
  assetBusy: boolean;
  assetError: string;
  assetStatusMessage: string;
  assetUploadProgress: number;
  filteredAssets: AssetRecord[];
  selectedAsset: AssetRecord | undefined;
  selectedAssetQuality: AssetQualityPreference;
  selectedAssetId: string;
  setSelectedAssetId: React.Dispatch<React.SetStateAction<string>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  selectedWidgetAcceptsAsset: boolean;
  canCreateAssets: boolean;
  canDeleteAssets: boolean;
  canUpdateAssets: boolean;
  addAssetFromUrl: () => Promise<void>;
  addAssetFromUrlToFolder: (folderId?: string) => Promise<void>;
  handleFileUpload: (file: File, folderId?: string) => void;
  handleFilesUpload: (files: FileList | File[], folderId?: string) => void;
  assignAsset: (asset: AssetRecord) => void;
  getAssetQualityPreference: (asset?: AssetRecord) => AssetQualityPreference;
  setAssetQualityPreference: (assetId: string, qualityPreference: AssetQualityPreference) => Promise<void>;
  resolveAssetPreviewUrl: (asset: AssetRecord) => string;
  refreshAssets: () => void;
  deleteAsset: (assetId: string) => Promise<void>;
  renameAssetById: (assetId: string, name: string) => Promise<void>;
  renameSelectedAsset: (name: string) => Promise<void>;
  reprocessSelectedAsset: () => Promise<void>;
};

const PROCESSING_STATUSES: AssetProcessingStatus[] = ['queued', 'processing', 'planned'];

export function useLeftRailAssets({
  primaryWidget,
  targetChannel,
  widgetActions,
}: LeftRailAssetsOptions): LeftRailAssetsState {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const platform = usePlatformActions();
  const canCreateAssets = usePlatformPermission('assets:create');
  const canDeleteAssets = usePlatformPermission('assets:delete');
  const canUpdateAssets = usePlatformPermission('assets:update');
  const isAuthenticated = platform.state.session.isAuthenticated;
  const sessionId = platform.state.session.sessionId;
  const selectedWidgetAcceptsAsset = widgetAcceptsAssetSwap(primaryWidget);

  function refreshAssets(): void {
    setAssetTick((value) => value + 1);
  }

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
  }, [assetTick, isAuthenticated, sessionId]);

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

  const filteredAssets = useMemo(() => {
    const normalized = assetQuery.trim().toLowerCase();
    return sortAssets(
      assets.filter((asset) => {
        const matchesKind = assetFilter === 'all' || asset.kind === assetFilter;
        const matchesText = !normalized || `${asset.name} ${asset.kind} ${(asset.tags ?? []).join(' ')}`.toLowerCase().includes(normalized);
        return matchesKind && matchesText;
      }),
      assetSort,
    );
  }, [assets, assetFilter, assetQuery, assetSort]);

  const assetCounts = useMemo(
    () => ({
      all: assets.length,
      image: assets.filter((asset) => asset.kind === 'image').length,
      video: assets.filter((asset) => asset.kind === 'video').length,
      font: assets.filter((asset) => asset.kind === 'font').length,
      other: assets.filter((asset) => asset.kind === 'other').length,
      processing: assets.filter((asset) => asset.processingStatus && PROCESSING_STATUSES.includes(asset.processingStatus)).length,
    }),
    [assets],
  );

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
    setAssets((current) => current.map((asset) => (asset.id === assetId ? { ...asset, qualityPreference } : asset)));
    try {
      await updateAssetQuality(assetId, qualityPreference);
      refreshAssets();
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : 'Could not update asset quality.');
      refreshAssets();
    }
  }

  function resolveAssetPreviewUrl(asset: AssetRecord): string {
    return resolveAssetPreviewImageUrl(asset, targetChannel, getAssetQualityPreference(asset));
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
    })
      .then((asset) => {
        setSelectedAssetId(asset.id);
        setAssetUploadProgress(100);
        setAssetStatusMessage(`${asset.name} uploaded successfully.`);
        refreshAssets();
      })
      .catch((error) => {
        setAssetError(error instanceof Error ? error.message : 'Could not upload asset.');
        setAssetStatusMessage('');
      })
      .finally(() => {
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
          })
            .then((asset) => {
              setSelectedAssetId(asset.id);
              setAssetUploadProgress(100);
              setAssetStatusMessage(`${asset.name} uploaded successfully.`);
              refreshAssets();
            })
            .catch((error) => {
              setAssetError(error instanceof Error ? error.message : `Could not upload ${file.name}.`);
            })
            .finally(() => {
              setAssetBusy(false);
              resolve();
            });
        });
      }
    })();
  }

  function assignAsset(asset: AssetRecord): void {
    assignAssetToWidget({
      asset,
      primaryWidget,
      widgetActions,
      resolveAssetPreviewUrl,
      getAssetQualityPreference,
    });
  }

  async function deleteAsset(assetId: string): Promise<void> {
    await removeAsset(assetId);
    if (selectedAssetId === assetId) setSelectedAssetId('');
    refreshAssets();
  }

  async function renameAssetById(assetId: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!assetId || !trimmed || !canUpdateAssets) return;
    await renameAsset(assetId, trimmed);
    refreshAssets();
  }

  async function renameSelectedAsset(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!selectedAsset?.id || !trimmed || !canUpdateAssets) return;
    await renameAssetById(selectedAsset.id, trimmed);
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

  return {
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
    fileInputRef,
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
    renameAssetById,
    renameSelectedAsset,
    reprocessSelectedAsset,
  };
}

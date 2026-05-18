import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { AssetLibraryFilesSection } from '../../../app/shell/AssetLibraryModal.sections';
import type { AssetRecord } from '../../../assets/types';

function createImageAsset(): AssetRecord {
  return {
    id: 'asset-image-1',
    name: 'Uploaded Hero',
    kind: 'image',
    src: 'https://cdn.example.com/hero.jpg',
    publicUrl: 'https://cdn.example.com/hero.jpg',
    createdAt: '2026-05-15T12:00:00.000Z',
  };
}

function createAssetController(asset: AssetRecord, assignAsset = vi.fn(), setSelectedAssetId = vi.fn()) {
  return {
    selectedAsset: asset,
    selectedWidgetAcceptsAsset: true,
    setSelectedAssetId,
    assignAsset,
    resolveAssetPreviewUrl: vi.fn(() => asset.src),
    renameAssetById: vi.fn(async () => undefined),
    assetBusy: false,
    assetStatusMessage: '',
    assetError: '',
    assetUploadProgress: 0,
    canUpdateAssets: true,
  };
}

function createLibraryController(asset: AssetRecord, isCompatibleWithSelection = vi.fn(() => true)) {
  return {
    selectedAssetIds: [],
    pageAssets: [asset],
    safePage: 1,
    pageCount: 1,
    draggedAssetIds: [],
    dragActive: false,
    folderBusy: false,
    selectedReprocessableCount: 0,
    visibleReprocessableCount: 0,
    reprocessTargetCount: 0,
    toggleAssetSelection: vi.fn(),
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
    isCompatibleWithSelection,
    setPage: vi.fn(),
  };
}

function findFirstAssetCard(root: ReactTestRenderer) {
  return root.root.find((node) => typeof node.props.className === 'string' && node.props.className.includes('asset-browser-card'));
}

describe('AssetLibraryFilesSection', () => {
  it('applies a clicked asset to the current selection and closes the modal', () => {
    const asset = createImageAsset();
    const assignAsset = vi.fn();
    const setSelectedAssetId = vi.fn();
    const onClose = vi.fn();
    const assetController = createAssetController(asset, assignAsset, setSelectedAssetId);
    const lib = createLibraryController(asset);
    let root: ReactTestRenderer | undefined;

    act(() => {
      root = create(
        <AssetLibraryFilesSection
          assetController={assetController as never}
          lib={lib as never}
          onClose={onClose}
        />,
      );
    });

    const card = findFirstAssetCard(root!);
    act(() => {
      card.props.onClick({ metaKey: false, ctrlKey: false, shiftKey: false });
    });

    expect(lib.toggleAssetSelection).toHaveBeenCalledWith('asset-image-1', false, false);
    expect(setSelectedAssetId).toHaveBeenCalledWith('asset-image-1');
    expect(assignAsset).toHaveBeenCalledWith(asset);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps plain selection behavior when the asset is not compatible with the active widget', () => {
    const asset = createImageAsset();
    const assignAsset = vi.fn();
    const setSelectedAssetId = vi.fn();
    const onClose = vi.fn();
    const assetController = createAssetController(asset, assignAsset, setSelectedAssetId);
    const lib = createLibraryController(asset, vi.fn(() => false));
    let root: ReactTestRenderer | undefined;

    act(() => {
      root = create(
        <AssetLibraryFilesSection
          assetController={assetController as never}
          lib={lib as never}
          onClose={onClose}
        />,
      );
    });

    const card = findFirstAssetCard(root!);
    act(() => {
      card.props.onClick({ metaKey: false, ctrlKey: false, shiftKey: false });
    });

    expect(lib.toggleAssetSelection).toHaveBeenCalledWith('asset-image-1', false, false);
    expect(setSelectedAssetId).toHaveBeenCalledWith('asset-image-1');
    expect(assignAsset).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps browsing on single click and applies on double click when opened as a picker request', () => {
    const asset = createImageAsset();
    const assignAsset = vi.fn();
    const setSelectedAssetId = vi.fn();
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const assetController = createAssetController(asset, assignAsset, setSelectedAssetId);
    const lib = createLibraryController(asset);
    let root: ReactTestRenderer | undefined;

    act(() => {
      root = create(
        <AssetLibraryFilesSection
          assetController={assetController as never}
          lib={lib as never}
          onClose={onClose}
          request={{ accept: 'image', title: 'Token image', onSelect }}
        />,
      );
    });

    const card = findFirstAssetCard(root!);
    act(() => {
      card.props.onClick({ metaKey: false, ctrlKey: false, shiftKey: false });
    });

    expect(lib.toggleAssetSelection).toHaveBeenCalledWith('asset-image-1', false, false);
    expect(setSelectedAssetId).toHaveBeenCalledWith('asset-image-1');
    expect(onSelect).not.toHaveBeenCalled();
    expect(assignAsset).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      card.props.onDoubleClick();
    });

    expect(onSelect).toHaveBeenCalledWith(asset);
    expect(assignAsset).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

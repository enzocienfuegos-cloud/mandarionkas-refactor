import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { AssetLibrarySection } from '../../../app/shell/left-rail/AssetLibrarySection';
import type { LeftRailController } from '../../../app/shell/left-rail/use-left-rail-controller';
import type { AssetRecord } from '../../../assets/types';
import type { WidgetNode } from '../../../domain/document/types';

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

function createWidget(type: WidgetNode['type']): WidgetNode {
  return {
    id: `widget-${type}`,
    type,
    name: type,
    sceneId: 'scene-1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 200, height: 100, rotation: 0 },
    props: {},
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

function createController(overrides: Partial<LeftRailController> = {}): LeftRailController {
  const asset = createImageAsset();
  return {
    assetQuery: '',
    setAssetQuery: vi.fn(),
    assetFilter: 'all',
    setAssetFilter: vi.fn(),
    assetSort: 'recent',
    setAssetSort: vi.fn(),
    assetUrl: '',
    setAssetUrl: vi.fn(),
    assetName: '',
    setAssetName: vi.fn(),
    assetScope: 'client',
    setAssetScope: vi.fn(),
    fileInputRef: { current: null },
    handleFileUpload: vi.fn(),
    addAssetFromUrl: vi.fn(async () => undefined),
    filteredAssets: [asset],
    selectedAsset: asset,
    selectedAssetQuality: 'auto',
    selectedAssetId: '',
    setSelectedAssetId: vi.fn(),
    primaryWidget: createWidget('image'),
    selectedWidgetAcceptsAsset: true,
    assignAsset: vi.fn(),
    getAssetQualityPreference: vi.fn(() => 'auto'),
    setAssetQualityPreference: vi.fn(async () => undefined),
    resolveAssetPreviewUrl: vi.fn(() => asset.src),
    deleteAsset: vi.fn(async () => undefined),
    renameSelectedAsset: vi.fn(async () => undefined),
    reprocessSelectedAsset: vi.fn(async () => undefined),
    canCreateAssets: true,
    canDeleteAssets: true,
    canUpdateAssets: true,
    assetBusy: false,
    assetError: '',
    assetCounts: { all: 1, image: 1, video: 0, font: 0, other: 0, processing: 0 },
    targetChannel: 'generic-html5',
    ...overrides,
  } as LeftRailController;
}

function findFirstAssetTile(root: ReactTestRenderer) {
  return root.root.find((node) => typeof node.props.className === 'string' && node.props.className.includes('asset-tile'));
}

describe('AssetLibrarySection', () => {
  it('applies an asset immediately when clicking a tile with a compatible widget selected', () => {
    const controller = createController();
    let root: ReactTestRenderer | undefined;

    act(() => {
      root = create(<AssetLibrarySection controller={controller} />);
    });

    const tile = findFirstAssetTile(root!);
    act(() => {
      tile.props.onClick();
    });

    expect(controller.setSelectedAssetId).toHaveBeenCalledWith('asset-image-1');
    expect(controller.assignAsset).toHaveBeenCalledWith(controller.filteredAssets[0]);
  });

  it('only selects the asset when the current widget is not compatible', () => {
    const controller = createController({
      primaryWidget: createWidget('video-hero'),
    });
    let root: ReactTestRenderer | undefined;

    act(() => {
      root = create(<AssetLibrarySection controller={controller} />);
    });

    const tile = findFirstAssetTile(root!);
    act(() => {
      tile.props.onClick();
    });

    expect(controller.setSelectedAssetId).toHaveBeenCalledWith('asset-image-1');
    expect(controller.assignAsset).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { assignAssetToWidget, widgetAcceptsAssetSwap } from '../../../app/shell/left-rail/asset-controller-helpers';
import type { AssetRecord } from '../../../assets/types';
import type { WidgetNode } from '../../../domain/document/types';

function createImageAsset(): AssetRecord {
  return {
    id: 'asset-image-1',
    name: 'Uploaded Hero',
    kind: 'image',
    src: 'https://cdn.example.com/hero.jpg',
    createdAt: '2026-05-15T12:00:00.000Z',
    publicUrl: 'https://cdn.example.com/hero.jpg',
  };
}

function createFontAsset(): AssetRecord {
  return {
    id: 'asset-font-1',
    name: 'Headline Sans',
    kind: 'font',
    src: 'https://cdn.example.com/headline-sans.woff2',
    createdAt: '2026-05-15T12:00:00.000Z',
    publicUrl: 'https://cdn.example.com/headline-sans.woff2',
    fontFamily: 'Headline Sans',
  };
}

function createTextWidget(): WidgetNode {
  return {
    id: 'widget-text',
    type: 'text',
    name: 'Text',
    sceneId: 'scene-1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 220, height: 116, rotation: 0 },
    props: { text: 'Hello' },
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

function createScratchRevealWidget(props: Record<string, unknown> = {}): WidgetNode {
  return {
    id: 'widget-scratch',
    type: 'scratch-reveal',
    name: 'Scratch & Reveal',
    sceneId: 'scene-1',
    zIndex: 1,
    frame: { x: 0, y: 0, width: 220, height: 116, rotation: 0 },
    props,
    style: {},
    timeline: { startMs: 0, endMs: 15000 },
  };
}

describe('asset controller helpers', () => {
  it('treats scratch-reveal as asset-assignable from the left rail', () => {
    expect(widgetAcceptsAssetSwap(createScratchRevealWidget())).toBe(true);
  });

  it('assigns the first dropped image to the reveal slot for scratch-reveal widgets', () => {
    const updateWidgetProps = vi.fn();

    assignAssetToWidget({
      asset: createImageAsset(),
      primaryWidget: createScratchRevealWidget(),
      widgetActions: { updateWidgetProps, updateWidgetStyle: vi.fn() },
      resolveAssetPreviewUrl: (asset) => asset.src,
      getAssetQualityPreference: () => 'auto',
    });

    expect(updateWidgetProps).toHaveBeenCalledWith('widget-scratch', {
      afterAssetId: 'asset-image-1',
      afterImage: 'https://cdn.example.com/hero.jpg',
    });
  });

  it('fills the cover slot next when the reveal slot is already populated', () => {
    const updateWidgetProps = vi.fn();

    assignAssetToWidget({
      asset: createImageAsset(),
      primaryWidget: createScratchRevealWidget({ afterImage: 'https://cdn.example.com/existing.jpg' }),
      widgetActions: { updateWidgetProps, updateWidgetStyle: vi.fn() },
      resolveAssetPreviewUrl: (asset) => asset.src,
      getAssetQualityPreference: () => 'auto',
    });

    expect(updateWidgetProps).toHaveBeenCalledWith('widget-scratch', {
      beforeAssetId: 'asset-image-1',
      beforeImage: 'https://cdn.example.com/hero.jpg',
    });
  });

  it('assigns a font asset to compatible text widgets', () => {
    const updateWidgetProps = vi.fn();
    const updateWidgetStyle = vi.fn();

    assignAssetToWidget({
      asset: createFontAsset(),
      primaryWidget: createTextWidget(),
      widgetActions: { updateWidgetProps, updateWidgetStyle },
      resolveAssetPreviewUrl: (asset) => asset.src,
      getAssetQualityPreference: () => 'auto',
    });

    expect(updateWidgetProps).toHaveBeenCalledWith('widget-text', {
      fontAssetId: 'asset-font-1',
      fontAssetSrc: 'https://cdn.example.com/headline-sans.woff2',
    });
    expect(updateWidgetStyle).toHaveBeenCalledWith('widget-text', {
      fontFamily: 'SMX_Headline_Sans_asset-',
    });
  });
});

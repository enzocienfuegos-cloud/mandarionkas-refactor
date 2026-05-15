import { describe, expect, it } from 'vitest';
import { isAssetCompatibleWithSelection } from '../../../app/shell/left-rail/asset-library-controller-helpers';
import type { AssetRecord } from '../../../assets/types';
import type { WidgetNode } from '../../../domain/document/types';

function createAsset(kind: AssetRecord['kind']): AssetRecord {
  return {
    id: `asset-${kind}`,
    name: `${kind} asset`,
    kind,
    src: `https://cdn.example.com/${kind}`,
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

describe('asset library controller helpers', () => {
  it('treats scratch-reveal widgets as compatible with image assets', () => {
    expect(isAssetCompatibleWithSelection(createAsset('image'), {
      primaryWidget: createWidget('scratch-reveal'),
      selectedWidgetAcceptsAsset: true,
    } as never)).toBe(true);
  });

  it('rejects video assets for scratch-reveal widgets', () => {
    expect(isAssetCompatibleWithSelection(createAsset('video'), {
      primaryWidget: createWidget('scratch-reveal'),
      selectedWidgetAcceptsAsset: true,
    } as never)).toBe(false);
  });
});

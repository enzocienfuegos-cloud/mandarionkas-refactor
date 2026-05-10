import { describe, expect, it } from 'vitest';
import { applyBrandKitToDocument } from '../../../domain/brand-kit/apply-to-document';
import { resolveBrandKitTokens } from '../../../domain/brand-kit/resolve-tokens';
import type { BrandKit } from '../../../domain/brand-kit/types';
import { createInitialState } from '../../../domain/document/factories';

const BRAND_KIT: BrandKit = {
  id: 'kit_1',
  workspaceId: 'client_1',
  name: 'Citrus System',
  brandId: 'brand_1',
  brandName: 'Citrus',
  colors: {
    background: '#fff8e8',
    text: '#102030',
    accent: '#ff7a18',
    border: '#ffd7b3',
  },
  typography: {
    fontFamily: 'Avenir Next',
    headingFamily: 'Avenir Next Condensed',
  },
  radii: {
    md: 18,
  },
  motion: {
    durationMs: 280,
    easing: 'ease-out',
  },
  logos: {
    primaryUrl: 'https://cdn.example.com/logo.svg',
  },
  createdAt: '2026-05-09T00:00:00.000Z',
  updatedAt: '2026-05-09T00:00:00.000Z',
};

describe('brand kit token resolution', () => {
  it('maps nested brand-kit tokens into flat stage/export tokens', () => {
    expect(resolveBrandKitTokens(BRAND_KIT)).toMatchObject({
      backgroundColor: '#fff8e8',
      textColor: '#102030',
      accentColor: '#ff7a18',
      borderColor: '#ffd7b3',
      fontFamily: 'Avenir Next',
      headingFontFamily: 'Avenir Next Condensed',
      borderRadius: 18,
      animationDurationMs: 280,
      animationEasing: 'ease-out',
      logoUrl: 'https://cdn.example.com/logo.svg',
    });
  });
});

describe('applyBrandKitToDocument', () => {
  it('replaces canvas/widget style tokens and stamps platform metadata', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0]?.id ?? 'scene_1';
    state.document.widgets.text_1 = {
      id: 'text_1',
      type: 'text',
      name: 'Headline',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 300, height: 60, rotation: 0 },
      props: {},
      style: { color: '#000000', borderRadius: 4 },
      timeline: { startMs: 0, endMs: 1000 },
    };

    const updated = applyBrandKitToDocument(state.document, BRAND_KIT);

    expect(updated.canvas.backgroundColor).toBe('#fff8e8');
    expect(updated.canvasVariants.every((variant) => variant.backgroundColor === '#fff8e8')).toBe(true);
    expect(updated.widgets.text_1?.style).toMatchObject({
      color: '#102030',
      accentColor: '#ff7a18',
      borderColor: '#ffd7b3',
      fontFamily: 'Avenir Next',
      borderRadius: 18,
      animationDurationMs: 280,
      animationEasing: 'ease-out',
    });
    expect(updated.metadata.platform).toMatchObject({
      brandKitId: 'kit_1',
      brandKitName: 'Citrus System',
      brandId: 'brand_1',
      brandName: 'Citrus',
    });
    expect(updated.metadata.dirty).toBe(true);
  });

  it('preserves existing values in merge mode and only touches selected slots', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0]?.id ?? 'scene_1';
    state.document.canvas.backgroundColor = '#111111';
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 220, height: 56, rotation: 0 },
      props: {},
      style: { backgroundColor: '#333333', color: '#ffffff' },
      timeline: { startMs: 0, endMs: 1000 },
    };

    const updated = applyBrandKitToDocument(state.document, BRAND_KIT, {
      mode: 'merge',
      targetSlots: ['accentColor', 'fontFamily'],
      applyCanvasBackground: false,
    });

    expect(updated.canvas.backgroundColor).toBe('#111111');
    expect(updated.widgets.cta_1?.style).toMatchObject({
      backgroundColor: '#333333',
      color: '#ffffff',
      accentColor: '#ff7a18',
      fontFamily: 'Avenir Next',
    });
  });
});

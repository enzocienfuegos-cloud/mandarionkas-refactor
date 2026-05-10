import { describe, expect, it } from 'vitest';
import { buildMetaCarouselViewModel } from '../../../widgets/modules/meta-carousel.view-model';

function createMetaCarouselFixture(patch?: Partial<{ props: Record<string, unknown>; frame: { width: number; height: number } }>) {
  return {
    props: {
      brandName: 'Brand Name',
      slideCount: 3,
      ...patch?.props,
    },
    frame: {
      width: 320,
      height: 280,
      ...patch?.frame,
    },
  } as const;
}

describe('meta carousel view model', () => {
  it('builds the requested number of slides with per-slide fields', () => {
    const viewModel = buildMetaCarouselViewModel(createMetaCarouselFixture({
      props: {
        slideCount: 2,
        slide2Kind: 'video',
        slide2Title: 'Product Two',
        slide2Description: 'Short copy',
      },
    }));

    expect(viewModel.slides).toHaveLength(2);
    expect(viewModel.slides[1]).toMatchObject({
      kind: 'video',
      title: 'Product Two',
      description: 'Short copy',
    });
  });

  it('clamps the carousel sizing inputs into safe bounds', () => {
    const viewModel = buildMetaCarouselViewModel(createMetaCarouselFixture({
      props: {
        cardWidthPct: 120,
        imageHeightPct: 10,
        cardGap: 1,
        cardRadius: -5,
      },
    }));

    expect(viewModel.cardWidthPct).toBe(100);
    expect(viewModel.imageHeightPct).toBe(20);
    expect(viewModel.gap).toBe(4);
    expect(viewModel.cardRadius).toBe(0);
  });

  it('derives card and image dimensions from the widget frame', () => {
    const viewModel = buildMetaCarouselViewModel(createMetaCarouselFixture({
      frame: { width: 400, height: 360 },
      props: { cardWidthPct: 75, imageHeightPct: 60 },
    }));

    expect(viewModel.cardW).toBe(282);
    expect(viewModel.imageH).toBe(109);
  });

  it('preserves header copy and cta label on the resolved model', () => {
    const viewModel = buildMetaCarouselViewModel(createMetaCarouselFixture({
      props: {
        brandAvatarSrc: 'https://cdn.example.com/avatar.png',
        sponsoredLabel: 'Patrocinado',
        primaryText: 'Nuevo lanzamiento',
        ctaLabel: 'Comprar',
      },
    }));

    expect(viewModel.avatarSrc).toContain('avatar.png');
    expect(viewModel.sponsored).toBe('Patrocinado');
    expect(viewModel.primaryText).toBe('Nuevo lanzamiento');
    expect(viewModel.ctaLabel).toBe('Comprar');
  });
});

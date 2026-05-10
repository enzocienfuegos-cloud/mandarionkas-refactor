import { describe, expect, it } from 'vitest';
import { buildFourFacesViewModel } from '../../../widgets/modules/four-faces.view-model';

function createFourFacesFixtureWidget(props: Record<string, unknown> = {}) {
  return {
    style: {},
    props: {
      accentColor: '#C8102E',
      homeTitle: 'Headline principal',
      homeSubtitle: 'Short description or product value proposition.',
      homeHintText: 'Swipe to explore',
      upTitle: 'Benefits',
      downTitle: 'Offers',
      leftTitle: 'Flavors',
      rightTitle: 'Moments',
      ...props,
    },
  } as const;
}

describe('four faces view model', () => {
  it('uses accent color as the primary fallback for home and directional ctas', () => {
    const viewModel = buildFourFacesViewModel(createFourFacesFixtureWidget({
      accentColor: '#FF5500',
    }));

    expect(viewModel.homeCtaBg).toBe('#FF5500');
    expect(viewModel.faces.up.ctaBg).toBe('#FF5500');
    expect(viewModel.faces.left.ctaBg).toBe('#FF5500');
    expect(viewModel.faces.right.ctaBg).toBe('#FF5500');
  });

  it('preserves face-specific defaults when a direction defines its own palette', () => {
    const viewModel = buildFourFacesViewModel(createFourFacesFixtureWidget());

    expect(viewModel.faces.down.headerBg).toBe('#F5C400');
    expect(viewModel.faces.down.ctaBg).toBe('#F5C400');
    expect(viewModel.faces.down.ctaTextColor).toBe('#1a1a1a');
  });

  it('resolves image, text and url props for each face', () => {
    const viewModel = buildFourFacesViewModel(createFourFacesFixtureWidget({
      rightImageSrc: 'https://cdn.example.com/right.jpg',
      rightBody: 'Lifestyle copy',
      rightCtaUrl: 'https://example.com/right',
    }));

    expect(viewModel.faces.right.imageSrc).toBe('https://cdn.example.com/right.jpg');
    expect(viewModel.faces.right.body).toBe('Lifestyle copy');
    expect(viewModel.faces.right.ctaUrl).toBe('https://example.com/right');
  });

  it('keeps boolean affordances enabled by default', () => {
    const viewModel = buildFourFacesViewModel(createFourFacesFixtureWidget({
      showDots: undefined,
      showArrows: undefined,
      showCloseButton: undefined,
    }));

    expect(viewModel.showDots).toBe(true);
    expect(viewModel.showArrows).toBe(true);
    expect(viewModel.showCloseButton).toBe(true);
  });

  it('derives premium home colors from the active module preset when defaults are untouched', () => {
    const viewModel = buildFourFacesViewModel({
      ...createFourFacesFixtureWidget(),
      style: { modulePreset: 'editorial' },
    });

    expect(viewModel.accentColor).not.toBe('#C8102E');
    expect(viewModel.homeBg).not.toBe('#F2F2F2');
    expect(viewModel.homeTitleColor).not.toBe('#1a1a1a');
  });
});

import { describe, expect, it } from 'vitest';
import { buildVerticalAccordionViewModel } from '../../../widgets/modules/vertical-accordion.view-model';

function createVerticalAccordionFixture(props: Record<string, unknown> = {}) {
  return {
    style: {},
    props: {
      brandLine1: 'BRAND NAME',
      brandLine2: 'Tagline',
      row1Title: 'Section One',
      row2Title: 'Section Two',
      row3Title: 'Section Three',
      ...props,
    },
  } as const;
}

describe('vertical accordion view model', () => {
  it('resolves the three rows with their individual props', () => {
    const viewModel = buildVerticalAccordionViewModel(createVerticalAccordionFixture({
      row2Chip: 'New',
      row2Src: 'https://cdn.example.com/two.jpg',
      row2Bg: '#112233',
      row2TextColor: '#ffeeaa',
    }));

    expect(viewModel.rows[1]).toMatchObject({
      title: 'Section Two',
      chip: 'New',
      src: 'https://cdn.example.com/two.jpg',
      bg: '#112233',
      textColor: '#ffeeaa',
    });
  });

  it('clamps autoplay interval and panel dimensions into safe bounds', () => {
    const viewModel = buildVerticalAccordionViewModel(createVerticalAccordionFixture({
      autoplayIntervalMs: 50,
      stripHeight: 200,
      expandedHeight: 20,
    }));

    expect(viewModel.autoplayIntervalMs).toBe(400);
    expect(viewModel.stripHeight).toBe(80);
    expect(viewModel.expandedHeight).toBe(100);
  });

  it('derives topbar height from visibility', () => {
    const shown = buildVerticalAccordionViewModel(createVerticalAccordionFixture());
    const hidden = buildVerticalAccordionViewModel(createVerticalAccordionFixture({
      showTopbar: false,
    }));

    expect(shown.topbarHeight).toBe(44);
    expect(hidden.topbarHeight).toBe(0);
  });

  it('keeps cta and endcard copy on the resolved model', () => {
    const viewModel = buildVerticalAccordionViewModel(createVerticalAccordionFixture({
      endcardLine1: 'DISCOVER',
      endcardLine2: 'THE RANGE',
      ctaText: 'Explore All >',
      ctaUrl: 'https://example.com/shop',
    }));

    expect(viewModel.endcardLine1).toBe('DISCOVER');
    expect(viewModel.endcardLine2).toBe('THE RANGE');
    expect(viewModel.ctaText).toBe('Explore All >');
    expect(viewModel.ctaUrl).toBe('https://example.com/shop');
  });

  it('derives premium defaults for cta and endcard when a module preset is active', () => {
    const viewModel = buildVerticalAccordionViewModel({
      ...createVerticalAccordionFixture(),
      style: { modulePreset: 'glass' },
    });

    expect(viewModel.ctaBg).toBeDefined();
    expect(viewModel.endcardBg).toBeDefined();
    expect(viewModel.ctaBg).not.toBe('#EE1C24');
    expect(viewModel.endcardBg).not.toBe('#004B93');
  });
});

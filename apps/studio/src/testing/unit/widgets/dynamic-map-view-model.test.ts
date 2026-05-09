import { describe, expect, it } from 'vitest';
import { createDynamicMapFixtureWidget, dynamicMapFixturePlaces } from '../../../widgets/modules/dynamic-map/fixtures';
import { buildDynamicMapViewModel } from '../../../widgets/modules/dynamic-map/view-model';

describe('dynamic map view model', () => {
  it('builds places from manual csv by default', () => {
    const widget = createDynamicMapFixtureWidget();
    const viewModel = buildDynamicMapViewModel(widget, [], null);

    expect(viewModel.places).toHaveLength(2);
    expect(viewModel.places[0]?.name).toBe('San Salvador');
    expect(viewModel.cardsOnly).toBe(false);
  });

  it('prefers provider places over manual csv when live data exists', () => {
    const widget = createDynamicMapFixtureWidget();
    const providerPlaces = [{
      ...dynamicMapFixturePlaces[0],
      name: 'Live Place',
    }];
    const viewModel = buildDynamicMapViewModel(widget, providerPlaces, null);

    expect(viewModel.places).toHaveLength(1);
    expect(viewModel.places[0]?.name).toBe('Live Place');
  });

  it('falls back to a synthetic place when there is no source data', () => {
    const widget = createDynamicMapFixtureWidget({
      props: {
        markersCsv: '',
        location: 'Fallback store',
        pinLabel: 'HQ',
      },
    });
    const viewModel = buildDynamicMapViewModel(widget, [], null);

    expect(viewModel.places).toHaveLength(1);
    expect(viewModel.places[0]).toMatchObject({
      name: 'Fallback store',
      badge: 'HQ',
    });
  });

  it('sorts by distance when geolocation is available', () => {
    const widget = createDynamicMapFixtureWidget();
    const viewModel = buildDynamicMapViewModel(widget, [], {
      latitude: 13.69,
      longitude: -89.22,
    });

    expect(viewModel.places[0]?.distanceKm).toBeLessThanOrEqual(viewModel.places[1]?.distanceKm ?? Number.MAX_SAFE_INTEGER);
    expect(viewModel.mapCenterLat).toBe(13.69);
  });

  it('derives search-bar layout values from the frame', () => {
    const widget = createDynamicMapFixtureWidget({
      frame: { width: 180, height: 320 },
      props: { renderMode: 'search-bar' },
    });
    const viewModel = buildDynamicMapViewModel(widget, [], null);

    expect(viewModel.searchBarMode).toBe(true);
    expect(viewModel.isVertical).toBe(true);
    expect(viewModel.heroHeight).toBe('46%');
    expect(viewModel.bottomHeight).toBe('54%');
  });

  it('derives premium panel defaults from the active module preset', () => {
    const widget = createDynamicMapFixtureWidget({
      style: { modulePreset: 'commerce' },
    });
    const viewModel = buildDynamicMapViewModel(widget, [], null);

    expect(viewModel.resolved.bottomBackgroundColor).not.toBe('#ffffff');
    expect(viewModel.resolved.searchBackgroundColor).not.toBe('rgba(255,255,255,0.7)');
    expect(viewModel.resolved.scrollbarThumbColor).not.toBe('#ffffff');
  });
});

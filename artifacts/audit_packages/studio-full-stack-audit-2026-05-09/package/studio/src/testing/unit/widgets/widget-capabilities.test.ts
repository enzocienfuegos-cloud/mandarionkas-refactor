import { describe, expect, it } from 'vitest';
import {
  acceptsAssetKind,
  getCapability,
} from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';

describe('widget capabilities', () => {
  it('marks core media widgets as swappable media', () => {
    const imageDefinition = getWidgetDefinition('image');
    const videoDefinition = getWidgetDefinition('video-hero');

    expect(getCapability(imageDefinition, 'acceptsAssetSwap')).toBe(true);
    expect(getCapability(imageDefinition, 'isMedia')).toBe(true);
    expect(acceptsAssetKind(imageDefinition, 'image')).toBe(true);

    expect(getCapability(videoDefinition, 'acceptsAssetSwap')).toBe(true);
    expect(acceptsAssetKind(videoDefinition, 'video')).toBe(true);
  });

  it('marks text-like widgets as font asset targets', () => {
    const textDefinition = getWidgetDefinition('text');
    const badgeDefinition = getWidgetDefinition('badge');

    expect(acceptsAssetKind(textDefinition, 'font')).toBe(true);
    expect(getCapability(textDefinition, 'acceptsAssetSwap')).toBe(true);
    expect(acceptsAssetKind(badgeDefinition, 'font')).toBe(true);
  });

  it('infers module capabilities for asset-backed modules', () => {
    const carouselDefinition = getWidgetDefinition('image-carousel');
    const interactiveVideoDefinition = getWidgetDefinition('interactive-video');
    const weatherDefinition = getWidgetDefinition('weather-conditions');
    const mapDefinition = getWidgetDefinition('dynamic-map');
    const genAiDefinition = getWidgetDefinition('gen-ai-image');

    expect(acceptsAssetKind(carouselDefinition, 'image')).toBe(true);
    expect(getCapability(carouselDefinition, 'acceptsAssetSwap')).toBe(true);
    expect(getCapability(carouselDefinition, 'isAssetGallery')).toBe(true);

    expect(acceptsAssetKind(interactiveVideoDefinition, 'video')).toBe(true);
    expect(getCapability(interactiveVideoDefinition, 'isMedia')).toBe(true);
    expect(getCapability(interactiveVideoDefinition, 'hasVideoAnalytics')).toBe(true);
    expect(getCapability(interactiveVideoDefinition, 'performsNetworkIo')).toBe(true);
    expect(getCapability(interactiveVideoDefinition, 'worksOffline')).toBe(false);

    expect(getCapability(weatherDefinition, 'performsNetworkIo')).toBe(true);
    expect(getCapability(weatherDefinition, 'hasRuntimeRandomness')).toBe(true);

    expect(getCapability(mapDefinition, 'requiresMraidHost')).toBe(true);
    expect(getCapability(mapDefinition, 'worksOffline')).toBe(false);

    expect(getCapability(genAiDefinition, 'performsNetworkIo')).toBe(true);
    expect(getCapability(genAiDefinition, 'hasRuntimeRandomness')).toBe(true);
  });

  it('marks container and text-variant widgets through capabilities', () => {
    const groupDefinition = getWidgetDefinition('group');
    const textDefinition = getWidgetDefinition('text');
    const ctaDefinition = getWidgetDefinition('cta');

    expect(getCapability(groupDefinition, 'isContainer')).toBe(true);
    expect(getCapability(textDefinition, 'hasTextVariant')).toBe(true);
    expect(getCapability(ctaDefinition, 'hasTextVariant')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { buildExportManifest, buildExportReadiness, buildMraidHandoff, buildReviewPackage, buildStandaloneHtml, getExportChannelProfile, validateExport } from '../../../export/engine';
import { registerBuiltins } from '../../../widgets/registry/register-builtins';

registerBuiltins();

describe('export engine', () => {
  it('flags CTA widgets without open-url actions', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 120, height: 40, rotation: 0 },
      style: {},
      props: { text: 'Buy now' },
      timeline: { startMs: 0, endMs: 1000 },
      actions: [],
    } as any;
    state.document.scenes[0].widgetIds.push('cta_1');

    const issues = validateExport(state);
    expect(issues.some((issue) => issue.scope === 'widget' && issue.message.includes('CTA'))).toBe(true);
  });

  it('builds readiness and manifest for target channel', () => {
    const state = createInitialState();
    state.document.name = 'Export Test';
    state.document.metadata.release.targetChannel = 'google-display';
    state.document.canvas.width = 300;
    state.document.canvas.height = 250;

    const readiness = buildExportReadiness(state);
    const manifest = buildExportManifest(state);

    expect(readiness.targetChannel).toBe('google-display');
    expect(readiness.checklist.length).toBeGreaterThan(0);
    expect(manifest.targetChannel).toBe('google-display');
    expect(manifest.documentName).toBe('Export Test');
  });

  it('registers iab and mraid export channel profiles', () => {
    expect(getExportChannelProfile('iab-html5').deliveryMode).toBe('html5');
    expect(getExportChannelProfile('mraid').exitStrategy).toBe('mraid-open');
  });

  it('includes channel metadata in review package for mraid', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;

    const reviewPackage = JSON.parse(buildReviewPackage(state));
    expect(reviewPackage.channel.id).toBe('mraid');
    expect(reviewPackage.channel.deliveryMode).toBe('mraid');
  });

  it('builds mraid handoff metadata for location-aware creatives', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.canvas.width = 320;
    state.document.canvas.height = 480;
    state.document.widgets.map_1 = {
      id: 'map_1',
      type: 'dynamic-map',
      name: 'Nearby Map',
      sceneId,
      zIndex: 1,
      frame: { x: 20, y: 30, width: 280, height: 180, rotation: 0 },
      style: { backgroundColor: '#dbeafe', accentColor: '#ef4444', color: '#0f172a' },
      props: {
        title: 'Nearby Locations',
        location: 'San Salvador',
        latitude: 13.6929,
        longitude: -89.2182,
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('map_1');

    const handoff = buildMraidHandoff(state);
    const manifest = buildExportManifest(state);
    const readiness = buildExportReadiness(state);

    expect(handoff.apiVersion).toBe('3.0');
    expect(handoff.placementType).toBe('interstitial');
    expect(handoff.requiredHostFeatures).toContain('location');
    expect(manifest.handoff?.mraid?.requiredHostFeatures).toContain('location');
    expect(readiness.hostRequirements?.requiredFeatures).toContain('location');
  });

  it('injects mraid bridge into standalone html for mraid channel', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'mraid';
    const html = buildStandaloneHtml(state);
    expect(html).toContain('window.smxMraidState');
    expect(html).toContain('window.smxOpenUrl');
    expect(html).toContain('window.smxGetRuntimeLocation');
    expect(html).toContain('window.mraid.open');
    expect(html).toContain("mraid.supports('location')");
    expect(html).toContain('window.mraid.getLocation()');
    expect(html).toContain("data-export-channel");
  });

  it('keeps standalone html on window-open strategy for generic html5', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'iab-html5';
    const html = buildStandaloneHtml(state);
    expect(html).toContain("window.open(url, '_blank', 'noopener,noreferrer')");
    expect(html).toContain('window.smxGetRuntimeLocation');
    expect(html).not.toContain('window.mraid.open');
    expect(html).not.toContain('window.smxMraidState');
    expect(html).not.toContain('data-mraid-ready');
  });

  it('keeps generic html5 export free of mraid bridge code', () => {
    const state = createInitialState();
    state.document.metadata.release.targetChannel = 'generic-html5';
    const html = buildStandaloneHtml(state);
    expect(html).not.toContain('window.mraid.open');
    expect(html).not.toContain('window.smxMraidState');
    expect(html).not.toContain('data-mraid-ready');
  });

  it('renders dynamic map export with runtime location resolver', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.metadata.release.targetChannel = 'mraid';
    state.document.widgets.map_1 = {
      id: 'map_1',
      type: 'dynamic-map',
      name: 'Nearby Map',
      sceneId,
      zIndex: 1,
      frame: { x: 20, y: 30, width: 280, height: 180, rotation: 0 },
      style: { backgroundColor: '#dbeafe', accentColor: '#ef4444', color: '#0f172a' },
      props: {
        title: 'Nearby Locations',
        location: 'San Salvador',
        latitude: 13.6929,
        longitude: -89.2182,
        zoom: 13,
        markersCsv: 'name,flag,lat,lng\nSan Salvador,SV,13.6929,-89.2182',
      },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('map_1');

    const html = buildStandaloneHtml(state);
    expect(html).toContain('widget-dynamic-map');
    expect(html).toContain('widget-map-locate');
    expect(html).toContain('window.smxGetRuntimeLocation');
    expect(html).toContain('Located via MRAID');
  });



  it('renders plugin widgets like badge in standalone html', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0].id;
    state.document.widgets.badge_1 = {
      id: 'badge_1',
      type: 'badge',
      name: 'Badge',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 180, height: 44, rotation: 0 },
      style: { backgroundColor: '#7c3aed', color: '#ffffff', borderRadius: 999 },
      props: { text: 'Limited drop', icon: '⚡' },
      timeline: { startMs: 0, endMs: 1000 },
    } as any;
    state.document.scenes[0].widgetIds.push('badge_1');

    const html = buildStandaloneHtml(state);
    expect(html).toContain('widget-badge');
    expect(html).toContain('Limited drop');
  });

  it('renders standalone html with manifest payload', () => {
    const state = createInitialState();
    state.document.name = 'Standalone';

    const html = buildStandaloneHtml(state);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('smx-export-manifest');
    expect(html).toContain('Standalone');
  });
});

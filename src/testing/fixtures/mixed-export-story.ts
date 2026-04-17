import { createInitialState, createScene } from '../../domain/document/factories';
import type { StudioState } from '../../domain/document/types';

export function createMixedExportStoryFixture(): StudioState {
  const state = createInitialState({
    name: 'Mixed Export Story',
    backgroundColor: 'linear-gradient(135deg, #0f172a, #1d4ed8)',
  });

  const introScene = state.document.scenes[0];
  introScene.id = 'scene_intro';
  introScene.name = 'Intro';
  introScene.order = 0;
  introScene.durationMs = 4200;
  introScene.transition = { type: 'fade', durationMs: 320 };

  const detailsScene = createScene(1, 'Details');
  detailsScene.id = 'scene_details';
  detailsScene.durationMs = 3600;
  detailsScene.transition = { type: 'slide-left', durationMs: 420 };
  state.document.scenes.push(detailsScene);

  state.document.selection.activeSceneId = introScene.id;
  state.document.canvas.width = 320;
  state.document.canvas.height = 480;

  state.document.widgets.title_intro = {
    id: 'title_intro',
    type: 'text',
    name: 'Intro Title',
    sceneId: introScene.id,
    zIndex: 1,
    frame: { x: 24, y: 28, width: 210, height: 62, rotation: 0 },
    props: { text: 'Spring edit', tag: 'h1' },
    style: {
      color: '#ffffff',
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: 0.2,
    },
    timeline: { startMs: 0, endMs: 4200 },
  };

  state.document.widgets.hero_image = {
    id: 'hero_image',
    type: 'image',
    name: 'Hero Image',
    sceneId: introScene.id,
    zIndex: 2,
    frame: { x: 20, y: 108, width: 280, height: 180, rotation: 0 },
    props: { src: 'https://cdn.example.com/assets/hero-card.jpg', alt: 'Hero visual' },
    style: { borderRadius: 20, boxShadow: '0 18px 45px rgba(15,23,42,0.35)' },
    timeline: { startMs: 0, endMs: 4200 },
  };

  state.document.widgets.offer_buttons = {
    id: 'offer_buttons',
    type: 'buttons',
    name: 'Offer Buttons',
    sceneId: introScene.id,
    zIndex: 3,
    frame: { x: 24, y: 316, width: 248, height: 88, rotation: 0 },
    props: {
      title: 'Actions',
      primaryLabel: 'Shop now',
      secondaryLabel: 'View details',
      orientation: 'horizontal',
    },
    style: {
      backgroundColor: '#0f766e',
      accentColor: '#67e8f9',
      color: '#ffffff',
      borderColor: 'rgba(255,255,255,0.18)',
      boxShadow: '0 18px 32px rgba(15,118,110,0.25)',
    },
    timeline: { startMs: 0, endMs: 4200 },
  };

  state.document.widgets.product_hotspot = {
    id: 'product_hotspot',
    type: 'interactive-hotspot',
    name: 'Product Hotspot',
    sceneId: introScene.id,
    zIndex: 4,
    frame: { x: 236, y: 72, width: 64, height: 64, rotation: 0 },
    props: { title: 'Details', label: 'Tap point', pulse: true, hotspotX: 50, hotspotY: 50 },
    style: {
      backgroundColor: '#172554',
      accentColor: '#f59e0b',
      color: '#ffffff',
      borderColor: 'rgba(255,255,255,0.16)',
    },
    timeline: { startMs: 0, endMs: 4200 },
  };

  state.document.widgets.details_badge = {
    id: 'details_badge',
    type: 'badge',
    name: 'Details Badge',
    sceneId: detailsScene.id,
    zIndex: 1,
    frame: { x: 24, y: 32, width: 170, height: 42, rotation: 0 },
    props: { text: 'Members only', icon: '★' },
    style: {
      color: '#ffffff',
      backgroundColor: '#7c3aed',
      borderRadius: 999,
      borderColor: 'rgba(255,255,255,0.18)',
      boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
    },
    timeline: { startMs: 0, endMs: 3600 },
  };

  state.document.widgets.details_copy = {
    id: 'details_copy',
    type: 'text',
    name: 'Details Copy',
    sceneId: detailsScene.id,
    zIndex: 2,
    frame: { x: 24, y: 94, width: 246, height: 68, rotation: 0 },
    props: { text: 'Fresh colorways for the season', tag: 'p' },
    style: {
      color: '#e2e8f0',
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.25,
    },
    timeline: { startMs: 600, endMs: 3600 },
  };

  state.document.widgets.details_cta = {
    id: 'details_cta',
    type: 'cta',
    name: 'Details CTA',
    sceneId: detailsScene.id,
    zIndex: 3,
    frame: { x: 24, y: 182, width: 210, height: 44, rotation: 0 },
    props: { text: 'Reveal offer', url: '' },
    style: {
      color: '#10161c',
      backgroundColor: '#facc15',
      fontSize: 20,
      fontWeight: 800,
      borderRadius: 999,
    },
    timeline: { startMs: 0, endMs: 3600 },
  };

  state.document.widgets.details_qr = {
    id: 'details_qr',
    type: 'qr-code',
    name: 'Details QR',
    sceneId: detailsScene.id,
    zIndex: 4,
    hidden: true,
    frame: { x: 206, y: 254, width: 92, height: 92, rotation: 0 },
    props: { url: 'https://example.com/member-drop' },
    style: { accentColor: '#111827', backgroundColor: '#ffffff' },
    timeline: { startMs: 0, endMs: 3600 },
  };

  introScene.widgetIds = ['title_intro', 'hero_image', 'offer_buttons', 'product_hotspot'];
  detailsScene.widgetIds = ['details_badge', 'details_copy', 'details_cta', 'details_qr'];

  state.document.actions.open_primary = {
    id: 'open_primary',
    widgetId: 'offer_buttons',
    trigger: 'click',
    type: 'open-url',
    targetKey: 'primary-button',
    url: 'https://example.com/shop',
    label: 'Primary button exit',
  };

  state.document.actions.go_details = {
    id: 'go_details',
    widgetId: 'offer_buttons',
    trigger: 'click',
    type: 'go-to-scene',
    targetKey: 'secondary-button',
    targetSceneId: detailsScene.id,
    label: 'Open details scene',
  };

  state.document.actions.toggle_qr = {
    id: 'toggle_qr',
    widgetId: 'product_hotspot',
    trigger: 'click',
    type: 'toggle-widget',
    targetKey: 'hotspot-pin',
    targetWidgetId: 'details_qr',
    label: 'Toggle QR reveal',
  };

  state.document.actions.update_details_copy = {
    id: 'update_details_copy',
    widgetId: 'details_cta',
    trigger: 'click',
    type: 'set-text',
    targetWidgetId: 'details_copy',
    text: 'Members unlock express shipping today',
    label: 'Update detail copy',
  };

  state.document.actions.timeline_show_qr = {
    id: 'timeline_show_qr',
    widgetId: 'details_copy',
    trigger: 'timeline-enter',
    type: 'show-widget',
    targetWidgetId: 'details_qr',
    label: 'Reveal QR on scene timing',
  };

  return state;
}

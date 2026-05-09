import { createInitialState } from '../../../domain/document/factories';
import type { StudioDocument, WidgetNode, WidgetType } from '../../../domain/document/types';
import { registerBuiltins } from '../../../widgets/registry/register-builtins';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import type { StudioTemplate, StudioTemplateMetadata, TemplateBuildOptions } from '../types';

type SimpleTemplateSpec = {
  metadata: StudioTemplateMetadata;
  palette: {
    background: string;
    surface: string;
    accent: string;
    text: string;
    muted: string;
  };
  badge: string;
  eyebrow?: string;
  headline: string;
  subhead: string;
  supporting: string;
  cta: string;
  imageLabel: string;
};

type WidgetSeedPatch = Partial<Omit<WidgetNode, 'id' | 'type' | 'sceneId' | 'zIndex'>> & {
  frame?: Partial<WidgetNode['frame']>;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  timeline?: Partial<WidgetNode['timeline']>;
};

function buildTemplatePoster(label: string, accent: string, surface: string, text: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="760" height="540" viewBox="0 0 760 540">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${surface}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="760" height="540" rx="48" fill="url(#g)" />
      <rect x="56" y="56" width="648" height="428" rx="32" fill="rgba(8,15,28,.18)" stroke="rgba(255,255,255,.24)" stroke-width="3" />
      <circle cx="188" cy="170" r="52" fill="rgba(255,255,255,.2)" />
      <circle cx="560" cy="364" r="68" fill="rgba(255,255,255,.12)" />
      <rect x="108" y="260" width="320" height="26" rx="13" fill="rgba(255,255,255,.92)" />
      <rect x="108" y="302" width="250" height="18" rx="9" fill="rgba(255,255,255,.65)" />
      <rect x="108" y="360" width="180" height="46" rx="23" fill="${text}" />
      <text x="198" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="${surface}">Launch</text>
      <text x="108" y="214" font-family="Arial, sans-serif" font-size="56" font-weight="800" fill="${text}">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seedWidget(type: WidgetType, sceneId: string, zIndex: number, patch: WidgetSeedPatch): WidgetNode {
  registerBuiltins();
  const base = getWidgetDefinition(type).defaults(sceneId, zIndex);
  return {
    ...base,
    ...patch,
    frame: { ...base.frame, ...(patch.frame ?? {}) },
    props: { ...base.props, ...(patch.props ?? {}) },
    style: { ...base.style, ...(patch.style ?? {}) },
    timeline: { ...base.timeline, ...(patch.timeline ?? {}) },
  };
}

export function buildSimpleTemplateDocument(spec: SimpleTemplateSpec, options?: TemplateBuildOptions): StudioDocument {
  const state = createInitialState({
    name: options?.name ?? spec.metadata.name,
    canvasPresetId: spec.metadata.canvasPresetId ?? 'leaderboard',
    backgroundColor: spec.palette.background,
  });
  const scene = state.document.scenes[0];
  const sceneId = scene.id;
  const poster = buildTemplatePoster(spec.imageLabel, spec.palette.accent, spec.palette.surface, spec.palette.text);

  const widgets = [
    seedWidget('shape', sceneId, 0, {
      name: 'Backdrop',
      frame: { x: 0, y: 0, width: state.document.canvas.width, height: state.document.canvas.height, rotation: 0 },
      props: { shape: 'rectangle' },
      style: { backgroundColor: spec.palette.background },
    }),
    seedWidget('shape', sceneId, 1, {
      name: 'Card Surface',
      frame: { x: 42, y: 26, width: Math.max(0, state.document.canvas.width - 84), height: Math.max(0, state.document.canvas.height - 52), rotation: 0 },
      props: { shape: 'rectangle' },
      style: { backgroundColor: spec.palette.surface, borderRadius: 28, opacity: 0.98 },
    }),
    seedWidget('badge', sceneId, 2, {
      name: 'Badge',
      frame: { x: 82, y: 66, width: 158, height: 38, rotation: 0 },
      props: { text: spec.badge },
      style: { backgroundColor: spec.palette.accent, color: spec.palette.surface, fontSize: 14, fontWeight: 800 },
    }),
    seedWidget('text', sceneId, 3, {
      name: 'Eyebrow',
      frame: { x: 82, y: 120, width: 360, height: 24, rotation: 0 },
      props: { text: spec.eyebrow ?? spec.metadata.vertical.toUpperCase() },
      style: { color: spec.palette.muted, fontSize: 13, fontWeight: 700, letterSpacing: 1.4 },
    }),
    seedWidget('text', sceneId, 4, {
      name: 'Headline',
      frame: { x: 82, y: 148, width: 360, height: 82, rotation: 0 },
      props: { text: options?.copy?.headline ?? spec.headline },
      style: { color: spec.palette.text, fontSize: 34, fontWeight: 800, lineHeight: 1.05 },
    }),
    seedWidget('text', sceneId, 5, {
      name: 'Subhead',
      frame: { x: 82, y: 238, width: 332, height: 48, rotation: 0 },
      props: { text: options?.copy?.subhead ?? spec.subhead },
      style: { color: spec.palette.muted, fontSize: 16, fontWeight: 500, lineHeight: 1.35 },
    }),
    seedWidget('text', sceneId, 6, {
      name: 'Supporting',
      frame: { x: 82, y: 300, width: 320, height: 32, rotation: 0 },
      props: { text: options?.copy?.supporting ?? spec.supporting },
      style: { color: spec.palette.text, fontSize: 14, fontWeight: 600, lineHeight: 1.3 },
    }),
    seedWidget('cta', sceneId, 7, {
      name: 'CTA',
      frame: { x: 82, y: 362, width: 196, height: 52, rotation: 0 },
      props: { text: options?.copy?.cta ?? spec.cta, url: '' },
      style: { backgroundColor: spec.palette.accent, color: spec.palette.surface, fontSize: 18, fontWeight: 800, borderRadius: 999 },
    }),
    seedWidget('image', sceneId, 8, {
      name: 'Hero Poster',
      frame: { x: Math.max(440, state.document.canvas.width - 404), y: 64, width: 320, height: 360, rotation: 0 },
      props: { src: poster, alt: spec.imageLabel },
      style: { backgroundColor: spec.palette.background, borderRadius: 32, fit: 'cover' },
    }),
  ];

  scene.widgetIds = widgets.map((widget) => widget.id);
  state.document.widgets = Object.fromEntries(widgets.map((widget) => [widget.id, widget]));
  state.document.name = options?.name ?? spec.metadata.name;
  return state.document;
}

export function createSimpleTemplate(spec: SimpleTemplateSpec): StudioTemplate {
  return {
    metadata: {
      ...spec.metadata,
      thumbnail: spec.metadata.thumbnail ?? buildTemplatePoster(spec.imageLabel, spec.palette.accent, spec.palette.surface, spec.palette.text),
    },
    buildDocument(options) {
      return buildSimpleTemplateDocument(spec, options);
    },
  };
}

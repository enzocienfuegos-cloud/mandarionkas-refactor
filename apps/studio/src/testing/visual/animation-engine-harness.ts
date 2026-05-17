import { createInitialState } from '../../domain/document/factories';
import { normalizeStudioState } from '../../domain/document/normalize-state';
import type { MotionSlot, StudioState, WidgetNode } from '../../domain/document/types';
import { buildGenericHtml5Adapter, buildChannelHtml, compileRuntime } from '../../export/engine';
import { buildClientPreviewSceneHtml } from '../../features/client-preview/ClientPreviewPlayer';
import { applyAnimationPreset } from '../../inspector/sections/animation-presets';
import { registerBuiltins } from '../../widgets/registry/register-builtins';

type HarnessScenario =
  | 'load-local-zero'
  | 'timeline-start'
  | 'reveal-idle'
  | 'scratch-stagger'
  | 'preview-parity'
  | 'no-managed-keyframes'
  | 'scratch-visible'
  | 'replay-restart'
  | 'replay-ignore'
  | 'legacy-parity';

registerBuiltins();

function configureCanvas(state: StudioState, width = 320, height = 480, backgroundColor = '#fff7ed'): StudioState {
  state.document.canvas = {
    ...state.document.canvas,
    width,
    height,
    backgroundColor,
  };
  state.document.canvasVariants = state.document.canvasVariants.map((variant, index) => ({
    ...variant,
    width,
    height,
    backgroundColor,
    isMaster: index === 0,
  }));
  return state;
}

function createMotionSlot(
  templateId: string,
  trigger: MotionSlot['trigger'],
  config: MotionSlot['config'],
  replayPolicy?: MotionSlot['replayPolicy'],
): MotionSlot {
  return {
    templateId,
    trigger,
    config,
    replayPolicy,
  };
}

function createTextWidget(
  id: string,
  label: string,
  overrides: Partial<WidgetNode> = {},
): WidgetNode {
  return {
    id,
    type: 'text',
    name: label,
    sceneId: overrides.sceneId ?? 'scene_1',
    zIndex: overrides.zIndex ?? 1,
    frame: overrides.frame ?? { x: 40, y: 180, width: 240, height: 64, rotation: 0 },
    props: {
      text: label,
      ...(overrides.props ?? {}),
    },
    style: {
      color: '#111827',
      fontSize: 34,
      fontWeight: 800,
      lineHeight: 1.1,
      textAlign: 'center',
      ...(overrides.style ?? {}),
    },
    timeline: overrides.timeline ?? { startMs: 0, endMs: 15000, keyframes: [] },
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    hidden: overrides.hidden,
    locked: overrides.locked,
    sharedLayerId: overrides.sharedLayerId,
    bindings: overrides.bindings,
    variants: overrides.variants,
    conditions: overrides.conditions,
  };
}

function createCtaWidget(
  id: string,
  label: string,
  overrides: Partial<WidgetNode> = {},
): WidgetNode {
  return {
    id,
    type: 'cta',
    name: label,
    sceneId: overrides.sceneId ?? 'scene_1',
    zIndex: overrides.zIndex ?? 2,
    frame: overrides.frame ?? { x: 60, y: 188, width: 200, height: 64, rotation: 0 },
    props: {
      text: label,
      ...(overrides.props ?? {}),
    },
    style: {
      backgroundColor: '#fb923c',
      color: '#111827',
      fontSize: 26,
      fontWeight: 800,
      borderRadius: 18,
      ...(overrides.style ?? {}),
    },
    timeline: overrides.timeline ?? { startMs: 0, endMs: 15000, keyframes: [] },
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    hidden: overrides.hidden,
    locked: overrides.locked,
    sharedLayerId: overrides.sharedLayerId,
    bindings: overrides.bindings,
    variants: overrides.variants,
    conditions: overrides.conditions,
  };
}

function createShapeWidget(
  id: string,
  overrides: Partial<WidgetNode> = {},
): WidgetNode {
  return {
    id,
    type: 'shape',
    name: overrides.name ?? 'Shape',
    sceneId: overrides.sceneId ?? 'scene_1',
    zIndex: overrides.zIndex ?? 1,
    frame: overrides.frame ?? { x: 80, y: 140, width: 160, height: 160, rotation: 0 },
    props: {
      shape: 'circle',
      ...(overrides.props ?? {}),
    },
    style: {
      backgroundColor: '#0f766e',
      borderColor: '#0f172a',
      opacity: 1,
      ...(overrides.style ?? {}),
    },
    timeline: overrides.timeline ?? { startMs: 0, endMs: 15000, keyframes: [] },
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    parentId: overrides.parentId,
    childIds: overrides.childIds,
    hidden: overrides.hidden,
    locked: overrides.locked,
    sharedLayerId: overrides.sharedLayerId,
    bindings: overrides.bindings,
    variants: overrides.variants,
    conditions: overrides.conditions,
  };
}

function createScratchGroup(
  id: string,
  overrides: Partial<WidgetNode> = {},
): WidgetNode {
  return {
    id,
    type: 'group',
    name: 'Scratch reveal',
    sceneId: overrides.sceneId ?? 'scene_1',
    zIndex: overrides.zIndex ?? 10,
    frame: overrides.frame ?? { x: 28, y: 96, width: 264, height: 288, rotation: 0 },
    props: {
      scratchEnabled: true,
      scratchRadius: 54,
      autoRevealThresholdPercent: 3,
      scratchActivationDelayMs: 0,
      revealTargetMode: 'auto',
      ...(overrides.props ?? {}),
    },
    style: {
      opacity: 1,
      borderRadius: 28,
      accentColor: '#f97316',
      ...(overrides.style ?? {}),
    },
    timeline: overrides.timeline ?? { startMs: 0, endMs: 15000, keyframes: [] },
    motion: overrides.motion,
    hoverMotion: overrides.hoverMotion,
    childIds: overrides.childIds ?? [],
    parentId: overrides.parentId,
    hidden: overrides.hidden,
    locked: overrides.locked,
    sharedLayerId: overrides.sharedLayerId,
    bindings: overrides.bindings,
    variants: overrides.variants,
    conditions: overrides.conditions,
  };
}

function attachWidgets(state: StudioState, widgets: WidgetNode[]): StudioState {
  const scene = state.document.scenes[0];
  scene.widgetIds = widgets.map((widget) => widget.id);
  state.document.widgets = Object.fromEntries(widgets.map((widget) => [widget.id, widget]));
  state.document.selection.activeSceneId = scene.id;
  widgets.forEach((widget) => {
    widget.sceneId = scene.id;
  });
  return state;
}

function buildInlineRuntimeHtml(state: StudioState): string {
  const adapter = buildGenericHtml5Adapter(state);
  const runtimeScript = compileRuntime(adapter.portableProject, adapter).replace(/<\/script>/gi, '<\\/script>');
  return buildChannelHtml(state, adapter).replace(
    '<script src="./runtime.js"></script>',
    `<script>${runtimeScript}</script>`,
  );
}

function buildLoadLocalZeroState(): StudioState {
  const state = configureCanvas(createInitialState());
  return attachWidgets(state, [
    createCtaWidget('load_cta', 'Kickoff', {
      motion: {
        enter: createMotionSlot('slide-in-left', 'load', { durationMs: 700, delayMs: 0, distancePx: 140 }),
      },
      timeline: { startMs: 2000, endMs: 12000, keyframes: [] },
    }),
  ]);
}

function buildTimelineTriggerState(): StudioState {
  const state = configureCanvas(createInitialState());
  return attachWidgets(state, [
    createCtaWidget('timeline_cta', 'Timeline', {
      motion: {
        enter: createMotionSlot('slide-in-left', 'timeline', { durationMs: 700, delayMs: 0, distancePx: 140 }),
      },
      timeline: { startMs: 2000, endMs: 12000, keyframes: [] },
    }),
  ]);
}

function buildScratchIdleRevealState(): StudioState {
  const state = configureCanvas(createInitialState());
  return attachWidgets(state, [
    createShapeWidget('reveal_orb', {
      zIndex: 1,
      frame: { x: 104, y: 160, width: 112, height: 112, rotation: 0 },
      style: { backgroundColor: '#0ea5e9', borderColor: '#082f49' },
      motion: {
        idle: createMotionSlot('float', 'reveal', { durationMs: 700, delayMs: 0, distancePx: 18 }),
      },
    }),
    createTextWidget('reveal_label', 'Scratch to reveal', {
      zIndex: 2,
      frame: { x: 48, y: 308, width: 224, height: 42, rotation: 0 },
      style: { color: '#0f172a', fontSize: 24, fontWeight: 700 },
    }),
    createScratchGroup('scratch_shell'),
  ]);
}

function buildScratchStaggerState(): StudioState {
  const state = configureCanvas(createInitialState());
  return attachWidgets(state, [
    createTextWidget('stagger_a', 'Alpha', {
      zIndex: 1,
      frame: { x: 52, y: 116, width: 216, height: 48, rotation: 0 },
      motion: {
        enter: createMotionSlot('fade-up', 'reveal', { durationMs: 520, delayMs: 0, distancePx: 48 }),
      },
    }),
    createTextWidget('stagger_b', 'Bravo', {
      zIndex: 2,
      frame: { x: 52, y: 190, width: 216, height: 48, rotation: 0 },
      style: { color: '#9a3412', fontSize: 34, fontWeight: 800 },
      motion: {
        enter: createMotionSlot('fade-up', 'reveal', { durationMs: 520, delayMs: 200, distancePx: 48 }),
      },
    }),
    createTextWidget('stagger_c', 'Charlie', {
      zIndex: 3,
      frame: { x: 52, y: 264, width: 216, height: 48, rotation: 0 },
      style: { color: '#1d4ed8', fontSize: 34, fontWeight: 800 },
      motion: {
        enter: createMotionSlot('fade-up', 'reveal', { durationMs: 520, delayMs: 400, distancePx: 48 }),
      },
    }),
    createScratchGroup('scratch_stagger'),
  ]);
}

function buildScratchVisibilityState(): StudioState {
  const state = configureCanvas(createInitialState());
  return attachWidgets(state, [
    createTextWidget('visible_after_reveal', 'Visible after reveal', {
      zIndex: 1,
      frame: { x: 34, y: 188, width: 252, height: 60, rotation: 0 },
      style: { color: '#065f46', fontSize: 32, fontWeight: 800 },
      motion: {
        enter: createMotionSlot('fade-in', 'reveal', { durationMs: 360, delayMs: 0 }),
      },
    }),
    createScratchGroup('scratch_visibility'),
  ]);
}

function buildClickReplayState(replayPolicy: MotionSlot['replayPolicy']): StudioState {
  const state = configureCanvas(createInitialState());
  return attachWidgets(state, [
    createCtaWidget(replayPolicy === 'ignore' ? 'ignore_cta' : 'restart_cta', replayPolicy === 'ignore' ? 'Ignore' : 'Restart', {
      motion: {
        enter: createMotionSlot('slide-in-up', 'click', { durationMs: 700, delayMs: 0, distancePx: 120 }, replayPolicy),
      },
    }),
  ]);
}

function buildLegacyComparisonState(): { legacy: StudioState; modern: StudioState } {
  const modern = configureCanvas(createInitialState());
  attachWidgets(modern, [
    createCtaWidget('legacy_compare', 'Legacy parity', {
      motion: {
        enter: createMotionSlot('slide-in-right', 'timeline', { durationMs: 700, delayMs: 0, distancePx: 120 }),
      },
      timeline: { startMs: 0, endMs: 12000, keyframes: [] },
    }),
  ]);

  const legacyRaw = configureCanvas(createInitialState());
  attachWidgets(legacyRaw, [
    createCtaWidget('legacy_compare', 'Legacy parity', {
      // TODO(animation-engine): legacy parity fixture intentionally exercises the pre-slot motion shape.
      motion: {
        templateId: 'slide-in-right',
        config: { durationMs: 700, delayMs: 0, distancePx: 120 },
      } as never,
      timeline: { startMs: 0, endMs: 12000, keyframes: [] },
    }),
  ]);

  return {
    modern,
    legacy: normalizeStudioState(legacyRaw),
  };
}

function mountParityPage(leftHtml: string, rightHtml: string, leftLabel: string, rightLabel: string): void {
  document.body.innerHTML = '';
  document.head.innerHTML = `
    <style>
      body { margin: 0; background: #111827; color: #f8fafc; font-family: Arial, sans-serif; }
      .parity-grid { display: grid; grid-template-columns: repeat(2, min-content); gap: 24px; padding: 24px; align-items: start; }
      .parity-card { display: grid; gap: 10px; }
      .parity-card h2 { margin: 0; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; }
      iframe { width: 320px; height: 480px; border: 1px solid rgba(255,255,255,.18); background: white; }
    </style>
  `;
  const wrapper = document.createElement('div');
  wrapper.className = 'parity-grid';
  wrapper.innerHTML = `
    <section class="parity-card">
      <h2>${leftLabel}</h2>
      <iframe data-preview="left" sandbox="allow-scripts allow-same-origin"></iframe>
    </section>
    <section class="parity-card">
      <h2>${rightLabel}</h2>
      <iframe data-preview="right" sandbox="allow-scripts allow-same-origin"></iframe>
    </section>
  `;
  document.body.appendChild(wrapper);
  const leftFrame = wrapper.querySelector<HTMLIFrameElement>('iframe[data-preview="left"]');
  const rightFrame = wrapper.querySelector<HTMLIFrameElement>('iframe[data-preview="right"]');
  if (leftFrame) leftFrame.srcdoc = leftHtml;
  if (rightFrame) rightFrame.srcdoc = rightHtml;
}

function mountDiagnosticPage(): void {
  const widget = createTextWidget('preset_probe', 'Preset probe', {
    timeline: {
      startMs: 0,
      endMs: 1000,
      keyframes: [
        { id: 'user_opacity', atMs: 180, property: 'opacity', value: 0.4 },
      ],
    },
  });
  const presetResult = applyAnimationPreset(widget, 'appear');
  const motionManagedKeyframes = presetResult.keyframes.filter((keyframe) => String(keyframe.managedBy ?? '').startsWith('motion:'));
  document.body.innerHTML = `
    <main data-diagnostic-root style="font-family: Arial, sans-serif; padding: 24px; display: grid; gap: 16px;">
      <h1 style="margin: 0;">Preset result</h1>
      <div data-summary style="font-size: 28px; font-weight: 800;">Managed keyframes: ${motionManagedKeyframes.length}</div>
      <pre style="margin: 0; padding: 16px; border-radius: 16px; background: #0f172a; color: #e2e8f0; white-space: pre-wrap;">${JSON.stringify(presetResult.motion, null, 2)}</pre>
    </main>
  `;
}

function mountPublicPage(state: StudioState): void {
  document.open();
  document.write(buildInlineRuntimeHtml(state));
  document.close();
}

function readScenario(): HarnessScenario {
  const value = new URL(window.location.href).searchParams.get('scenario');
  switch (value) {
    case 'load-local-zero':
    case 'timeline-start':
    case 'reveal-idle':
    case 'scratch-stagger':
    case 'preview-parity':
    case 'no-managed-keyframes':
    case 'scratch-visible':
    case 'replay-restart':
    case 'replay-ignore':
    case 'legacy-parity':
      return value;
    default:
      return 'load-local-zero';
  }
}

export function bootAnimationEngineVisualHarness(): void {
  switch (readScenario()) {
    case 'load-local-zero':
      mountPublicPage(buildLoadLocalZeroState());
      break;
    case 'timeline-start':
      mountPublicPage(buildTimelineTriggerState());
      break;
    case 'reveal-idle':
      mountPublicPage(buildScratchIdleRevealState());
      break;
    case 'scratch-stagger':
      mountPublicPage(buildScratchStaggerState());
      break;
    case 'preview-parity': {
      const state = buildScratchStaggerState();
      mountParityPage(buildClientPreviewSceneHtml(state, 0), buildInlineRuntimeHtml(state), 'Client Preview', 'Public Preview');
      break;
    }
    case 'no-managed-keyframes':
      mountDiagnosticPage();
      break;
    case 'scratch-visible':
      mountPublicPage(buildScratchVisibilityState());
      break;
    case 'replay-restart':
      mountPublicPage(buildClickReplayState('restart'));
      break;
    case 'replay-ignore':
      mountPublicPage(buildClickReplayState('ignore'));
      break;
    case 'legacy-parity': {
      const { legacy, modern } = buildLegacyComparisonState();
      mountParityPage(buildInlineRuntimeHtml(legacy), buildInlineRuntimeHtml(modern), 'Legacy normalized', 'Slot model');
      break;
    }
  }
}

import { describe, expect, it } from 'vitest';
import type { StudioState, WidgetNode } from '../../../domain/document/types';
import { renderGroupExport } from '../../../widgets/group/group.export';

function createGroupWidget(props: Partial<WidgetNode['props']> = {}): WidgetNode {
  return {
    id: 'group_1',
    type: 'group',
    name: 'Scratch group',
    sceneId: 'scene_1',
    zIndex: 3,
    frame: { x: 0, y: 0, width: 220, height: 160, rotation: 0 },
    style: {
      accentColor: '#8b5cf6',
      color: '#ffffff',
      borderRadius: 18,
      opacity: 1,
    },
    props: {
      title: 'Scratch group',
      scratchEnabled: true,
      scratchRadius: 24,
      autoRevealThresholdPercent: 10,
      ...props,
    },
    timeline: { startMs: 0, endMs: 1000 },
    childIds: ['text_1', 'cta_1'],
  };
}

function createState(): StudioState {
  const group = createGroupWidget();
  const text: WidgetNode = {
    id: 'text_1',
    type: 'text',
    name: 'Text',
    sceneId: 'scene_1',
    zIndex: 1,
    parentId: 'group_1',
    frame: { x: 12, y: 16, width: 140, height: 48, rotation: 0 },
    props: { text: 'Scratch me first' },
    style: { color: '#ffffff', fontSize: 24, fontWeight: 700 },
    timeline: { startMs: 0, endMs: 1000 },
  };
  const cta: WidgetNode = {
    id: 'cta_1',
    type: 'cta',
    name: 'CTA',
    sceneId: 'scene_1',
    zIndex: 2,
    parentId: 'group_1',
    frame: { x: 24, y: 92, width: 120, height: 36, rotation: 0 },
    props: { text: 'Shop now', url: 'https://example.com' },
    style: { color: '#10161c', backgroundColor: '#ffd400', fontSize: 16, fontWeight: 700 },
    timeline: { startMs: 0, endMs: 1000 },
  };

  return {
    document: {
      id: 'doc_1',
      name: 'Scratch export',
      version: 1,
      canvas: { width: 320, height: 480, backgroundColor: '#000000' },
      canvasVariants: [{ id: 'cv_1', label: '320×480', width: 320, height: 480, backgroundColor: '#000000', isMaster: true, presetId: 'custom' }],
      activeCanvasVariantId: 'cv_1',
      widgetOverrides: {},
      sharedLayers: {},
      scenes: [{ id: 'scene_1', name: 'Scene 1', order: 0, widgetIds: ['group_1', 'text_1', 'cta_1'], durationMs: 1000 }],
      widgets: {
        group_1: group,
        text_1: text,
        cta_1: cta,
      },
      actions: {},
      feeds: { custom: [] as never[] } as StudioState['document']['feeds'],
      collaboration: { comments: [], approvals: [] },
      selection: { widgetIds: ['group_1'], activeSceneId: 'scene_1', primaryWidgetId: 'group_1' },
      metadata: { dirty: false, release: { targetChannel: 'generic-html5', qaStatus: 'draft' } },
    },
    ui: {
      zoom: 1,
      playheadMs: 0,
      isPlaying: false,
      previewMode: false,
      previewContext: 'none',
      editModeWireframe: false,
      activeVariant: 'default',
      activeFeedSource: 'custom',
      activeFeedRecordId: '',
      activeLeftTab: 'widgets',
      stageBackdrop: 'dark',
      showStageRulers: false,
      showWidgetBadges: false,
    },
  };
}

describe('group scratch export', () => {
  it('renders a scratch shell when the group is scratch-enabled', () => {
    const html = renderGroupExport(createGroupWidget(), createState());

    expect(html).toContain('widget-group-scratch');
    expect(html).toContain('class="scratch-reveal-shell"');
    expect(html).toContain('data-scratch-shell');
    expect(html).toContain('data-scratch-mask-target');
    expect(html).toContain('data-scratch-auto-reveal-threshold="10"');
    expect(html).toContain('data-scratch-milestones="[]"');
    expect(html).toContain('data-scratch-reveal-target-mode="auto"');
    expect(html).toContain('data-scratch-reveal-target-id=""');
    expect(html).toContain('Scratch me first');
    expect(html).toContain('Shop now');
    expect(html).toContain('data-scratch-canvas');
  });

  it('serializes scratch milestones in ascending order', () => {
    const state = createState();
    state.document.widgets.group_1 = createGroupWidget({
      scratchMilestones: [
        { id: 'm3', thresholdPercent: 75, emitTrigger: 'completion' },
        { id: 'm1', thresholdPercent: 25, emitTrigger: 'reveal' },
        { id: 'm2', thresholdPercent: 50, emitTrigger: 'scratch-complete' },
      ],
      revealTargetMode: 'scene',
      revealTargetId: 'scene_2',
    });

    const html = renderGroupExport(state.document.widgets.group_1, state);

    expect(html).toContain('data-scratch-reveal-target-mode="scene"');
    expect(html).toContain('data-scratch-reveal-target-id="scene_2"');
    expect(html).toContain('&quot;id&quot;:&quot;m1&quot;');
    expect(html.indexOf('&quot;id&quot;:&quot;m1&quot;')).toBeLessThan(html.indexOf('&quot;id&quot;:&quot;m2&quot;'));
    expect(html.indexOf('&quot;id&quot;:&quot;m2&quot;')).toBeLessThan(html.indexOf('&quot;id&quot;:&quot;m3&quot;'));
  });

  it('wraps scratch cover children so grouped animations survive export runtime', () => {
    const state = createState();
    state.document.widgets.text_1.motion = {
      templateId: 'float',
      config: { durationMs: 1800 },
    } as any;
    state.document.widgets.text_1.timeline = {
      startMs: 0,
      endMs: 1000,
      keyframes: [
        { id: 'kf_1', property: 'x', atMs: 0, value: 12, easing: 'linear' },
        { id: 'kf_2', property: 'x', atMs: 1000, value: 80, easing: 'ease-out' },
      ],
    } as any;
    const html = renderGroupExport(state.document.widgets.group_1, state);

    expect(html).toContain('data-scratch-cover-widget-id="text_1"');
    expect(html).toContain('data-scratch-cover-motion-id="text_1"');
    expect(html).toContain('data-scratch-origin-x="0"');
    expect(html).toContain('data-scratch-origin-y="0"');
    expect(html).toContain('left:12px');
    expect(html).toContain('position:absolute;left:0px;top:0px');
  });

  it('expands the scratch group export frame when children extend outside the original group bounds', () => {
    const state = createState();
    state.document.widgets.group_1.frame = { x: 40, y: 60, width: 120, height: 80, rotation: 0 };
    state.document.widgets.text_1.frame = { x: 12, y: 16, width: 220, height: 48, rotation: 0 };
    const html = renderGroupExport(state.document.widgets.group_1, state);

    expect(html).toContain('left:12px');
    expect(html).toContain('top:16px');
    expect(html).toContain('width:220px');
    expect(html).toContain('height:124px');
  });

  it('falls back to the regular group export when scratch is disabled', () => {
    const html = renderGroupExport(createGroupWidget({ scratchEnabled: false }));

    expect(html).not.toContain('class="scratch-reveal-shell"');
    expect(html).toContain('>Group<');
  });
});

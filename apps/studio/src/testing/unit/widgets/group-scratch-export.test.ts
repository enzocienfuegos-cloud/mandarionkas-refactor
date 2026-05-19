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
  it('renders a single Canvas scratch shell when the group is scratch-enabled', () => {
    const html = renderGroupExport(createGroupWidget(), createState());

    expect(html).toContain('widget-group-scratch');
    expect(html).toContain('class="scratch-reveal-shell"');
    expect(html).toContain('data-scratch-shell');
    expect(html).toContain('data-scratch-canvas');
    expect(html).toContain('data-scratch-cover-layer');
    expect(html).toContain('data-scratch-hit-area');
    expect(html).toContain('data-scratch-auto-reveal-threshold="10"');
    expect(html).toContain('data-scratch-milestones="[]"');
    expect(html).toContain('data-scratch-reveal-target-mode="auto"');
    expect(html).toContain('data-scratch-reveal-target-id=""');
    expect(html).toContain('data-scratch-replay-target-motion-on-reveal="true"');
    expect(html).toContain('data-scratch-cover-color="#8b5cf6"');
    expect(html).not.toContain('data-scratch-mask-svg');
    expect(html).not.toContain('data-scratch-mask-target');
    expect(html).not.toContain('data-scratch-target-content');
    expect(html).not.toContain('data-scratch-cover-widget-id');
    expect(html).not.toContain('Scratch me first');
    expect(html).not.toContain('Shop now');
    expect(html).not.toMatch(/url\(["']?blob:/);
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

  it('serializes when target motion replay is explicitly disabled', () => {
    const html = renderGroupExport(createGroupWidget({ replayTargetMotionOnReveal: false }), createState());

    expect(html).toContain('data-scratch-replay-target-motion-on-reveal="false"');
  });

  it('does not clone internal target content into the scratch shell', () => {
    const state = createState();
    const targetGroup: WidgetNode = {
      id: 'target_group',
      type: 'group',
      name: 'Target group',
      sceneId: 'scene_1',
      zIndex: 1,
      parentId: 'group_1',
      frame: { x: 18, y: 14, width: 180, height: 100, rotation: 0 },
      props: { title: 'Target group' },
      style: { backgroundColor: '#ffffff', borderRadius: 20, opacity: 1 },
      timeline: { startMs: 0, endMs: 1000 },
      childIds: ['text_1'],
    };

    state.document.widgets.group_1.childIds = ['target_group', 'cta_1'];
    state.document.widgets.text_1.parentId = 'target_group';
    state.document.widgets.group_1.props.revealTargetMode = 'widget';
    state.document.widgets.group_1.props.revealTargetId = 'target_group';
    state.document.widgets.target_group = targetGroup;
    state.document.scenes[0].widgetIds = ['group_1', 'target_group', 'text_1', 'cta_1'];

    const html = renderGroupExport(state.document.widgets.group_1, state);

    expect(html).toContain('data-scratch-reveal-target-mode="widget"');
    expect(html).toContain('data-scratch-reveal-target-id="target_group"');
    expect(html).not.toContain('data-scratch-target-content');
    expect(html).not.toContain('data-scratch-cover-widget-id="target_group"');
  });

  it('uses the parent group frame for the Canvas overlay', () => {
    const state = createState();
    state.document.widgets.group_1.frame = { x: 40, y: 60, width: 120, height: 80, rotation: 0 };
    state.document.widgets.text_1.frame = { x: 12, y: 16, width: 220, height: 48, rotation: 0 };
    const html = renderGroupExport(state.document.widgets.group_1, state);

    expect(html).toContain('left:40px');
    expect(html).toContain('top:60px');
    expect(html).toContain('width:120px');
    expect(html).toContain('height:80px');
  });

  it('falls back to the regular group export when scratch is disabled', () => {
    const html = renderGroupExport(createGroupWidget({ scratchEnabled: false }));

    expect(html).not.toContain('class="scratch-reveal-shell"');
    expect(html).toContain('>Group<');
  });
});

import { describe, expect, it } from 'vitest';
import type { StudioState } from '../../../domain/document/types';
import { selectStageState } from '../../../core/store/selectors/stage-selectors';

function createState(playheadMs: number): StudioState {
  return {
    document: {
      id: 'doc_1',
      name: 'Test document',
      version: 1,
      canvas: { width: 320, height: 480, backgroundColor: '#000000' },
      canvasVariants: [],
      activeCanvasVariantId: 'default',
      widgetOverrides: {},
      sharedLayers: {},
      scenes: [
        {
          id: 'scene_1',
          name: 'Scene 1',
          order: 0,
          widgetIds: ['widget_1'],
          durationMs: 2000,
        },
      ],
      widgets: {
        widget_1: {
          id: 'widget_1',
          type: 'text',
          name: 'Widget 1',
          sceneId: 'scene_1',
          zIndex: 1,
          frame: { x: 0, y: 0, width: 120, height: 48, rotation: 0 },
          props: { text: 'hello' },
          style: {},
          timeline: { startMs: 0, endMs: 2000 },
        },
      },
      actions: {},
      feeds: {
        product: [],
        weather: [],
        location: [],
        custom: [],
      },
      collaboration: { comments: [], approvals: [] },
      selection: { widgetIds: ['widget_1'], activeSceneId: 'scene_1', primaryWidgetId: 'widget_1' },
      metadata: { dirty: false, release: { targetChannel: 'generic-html5', qaStatus: 'draft' } },
    },
    ui: {
      zoom: 1,
      playheadMs,
      isPlaying: true,
      previewMode: true,
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

describe('selectStageState', () => {
  it('reuses document-derived references when only playhead changes', () => {
    const state = createState(0);
    const first = selectStageState(state);
    const second = selectStageState({
      ...state,
      ui: {
        ...state.ui,
        playheadMs: 480,
      },
    });

    expect(second.widgetsById).toBe(first.widgetsById);
    expect(second.widgets).toBe(first.widgets);
    expect(second.scene).toBe(first.scene);
    expect(second.canvas).toBe(first.canvas);
    expect(second.selectedIds).toBe(first.selectedIds);
  });
});

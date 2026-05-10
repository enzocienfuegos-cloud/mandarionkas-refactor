import { describe, expect, it } from 'vitest';
import type { StudioCommand } from '../../core/commands/types';
import { reduceBySlices } from '../../core/store/reducers';
import { createInitialState } from '../../domain/document/factories';
import type { StudioState } from '../../domain/document/types';
import { buildExportManifest, buildExportReadiness } from '../../export/engine';

function applyCommands(state: StudioState, ...commands: StudioCommand[]): StudioState {
  return commands.reduce((next, command) => reduceBySlices(next, command), state);
}

describe('editor smoke paths', () => {
  it('authors a basic multi-scene story and produces export-ready metadata', () => {
    let state = createInitialState();
    const firstSceneId = state.document.selection.activeSceneId;

    state = applyCommands(
      state,
      { type: 'UPDATE_DOCUMENT_NAME', name: 'Smoke Story' },
      { type: 'CREATE_WIDGET', widgetType: 'text' },
    );

    const textId = state.document.selection.primaryWidgetId!;

    state = applyCommands(
      state,
      { type: 'UPDATE_WIDGET_NAME', widgetId: textId, name: 'Hero Copy' },
      { type: 'UPDATE_WIDGET_PROPS', widgetId: textId, patch: { text: 'Hello smoke story' } },
      { type: 'UPDATE_WIDGET_FRAME', widgetId: textId, patch: { x: 64, y: 40, width: 360, height: 80 } },
      { type: 'CREATE_WIDGET', widgetType: 'badge' },
    );

    const badgeId = state.document.selection.primaryWidgetId!;

    state = applyCommands(
      state,
      { type: 'UPDATE_WIDGET_PROPS', widgetId: badgeId, patch: { text: 'Limited drop', icon: '⚡' } },
      { type: 'UPDATE_WIDGET_FRAME', widgetId: badgeId, patch: { x: 64, y: 130, width: 200, height: 44 } },
      { type: 'CREATE_WIDGET', widgetType: 'cta' },
    );

    const ctaId = state.document.selection.primaryWidgetId!;

    state = applyCommands(
      state,
      { type: 'UPDATE_WIDGET_PROPS', widgetId: ctaId, patch: { text: 'Open now' } },
      { type: 'UPDATE_WIDGET_FRAME', widgetId: ctaId, patch: { x: 64, y: 150, width: 180, height: 52 } },
      { type: 'ADD_WIDGET_ACTION', widgetId: ctaId, trigger: 'click', actionType: 'open-url' },
    );

    const ctaActionId = Object.values(state.document.actions).find((action) => action.widgetId === ctaId)?.id;
    expect(ctaActionId).toBeTruthy();

    state = applyCommands(
      state,
      { type: 'UPDATE_WIDGET_ACTION', actionId: ctaActionId!, patch: { label: 'Primary CTA', url: 'https://example.com/smoke' } },
      { type: 'ADD_SCENE' },
    );

    const secondSceneId = state.document.selection.activeSceneId;

    state = applyCommands(
      state,
      { type: 'CREATE_WIDGET', widgetType: 'image' },
      {
        type: 'UPDATE_RELEASE_SETTINGS',
        patch: {
          targetChannel: 'generic-html5',
          qaStatus: 'ready-for-qa',
        },
      },
      { type: 'SELECT_SCENE', sceneId: firstSceneId },
      { type: 'UPDATE_SCENE', sceneId: firstSceneId, patch: { flow: { nextSceneId: secondSceneId } } },
    );

    const readiness = buildExportReadiness(state);
    const manifest = buildExportManifest(state);

    expect(state.document.scenes).toHaveLength(2);
    expect(readiness.blockers).toBe(0);
    expect(readiness.qaStatus).toBe('ready-for-qa');
    expect(manifest.sceneCount).toBe(2);
    expect(manifest.widgetCount).toBe(4);
    expect(manifest.actionCount).toBe(1);
    expect(manifest.documentName).toBe('Smoke Story');
  });
});

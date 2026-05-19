/** @vitest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import * as diagnosticsModule from '../../../domain/document/diagnostics';
import * as engineModule from '../../../export/engine';
import { useExportReadinessController } from '../../../app/shell/topbar/use-export-readiness-controller';
import type { TopBarStudioSnapshot } from '../../../app/shell/topbar/top-bar-types';

function createMockSnapshot(name = 'Lazy readiness test'): TopBarStudioSnapshot {
  const state = createInitialState({ name });
  return {
    state,
    name: state.document.name,
    dirty: state.document.metadata.dirty,
    selectionCount: state.document.selection.widgetIds.length,
    zoom: state.ui.zoom,
    playhead: state.ui.playheadMs,
    isPlaying: state.ui.isPlaying,
    previewMode: state.ui.previewMode,
    previewContext: state.ui.previewContext,
    editModeWireframe: state.ui.editModeWireframe,
    lastAction: state.ui.lastTriggeredActionLabel,
    activeVariant: state.ui.activeVariant,
    activeFeedSource: state.ui.activeFeedSource,
    activeFeedRecordId: state.ui.activeFeedRecordId,
    activeProjectId: state.ui.activeProjectId,
    activeSceneId: state.document.selection.activeSceneId,
    scenes: state.document.scenes,
    canvasPresetId: state.document.canvas.presetId ?? 'custom',
    release: state.document.metadata.release,
    lastSavedAt: state.document.metadata.lastSavedAt,
    lastAutosavedAt: state.document.metadata.lastAutosavedAt,
    platformMeta: state.document.metadata.platform,
    documentVersion: state.document.version,
  };
}

function createMraidSnapshot(): TopBarStudioSnapshot {
  const snapshot = createMockSnapshot('Lazy readiness mraid');
  snapshot.state.document.metadata.release.targetChannel = 'mraid';
  snapshot.release = snapshot.state.document.metadata.release;
  return snapshot;
}

describe('useExportReadinessController lazy getters', () => {
  it('keeps handoff/readiness/diagnostics lazy on initial render', () => {
    const handoffSpy = vi.spyOn(engineModule, 'buildExportHandoff');
    const readinessSpy = vi.spyOn(engineModule, 'buildExportReadiness');
    const diagnosticsSpy = vi.spyOn(diagnosticsModule, 'buildDiagnosticSummary');

    renderHook(() => useExportReadinessController(createMockSnapshot()));

    expect(handoffSpy).not.toHaveBeenCalled();
    expect(readinessSpy).not.toHaveBeenCalled();
    expect(diagnosticsSpy).not.toHaveBeenCalled();

    handoffSpy.mockRestore();
    readinessSpy.mockRestore();
    diagnosticsSpy.mockRestore();
  });

  it('does not run heavy getters across repeated rerenders unless invoked', () => {
    const handoffSpy = vi.spyOn(engineModule, 'buildExportHandoff');
    const readinessSpy = vi.spyOn(engineModule, 'buildExportReadiness');
    const diagnosticsSpy = vi.spyOn(diagnosticsModule, 'buildDiagnosticSummary');

    const { rerender } = renderHook(
      ({ snapshot }) => useExportReadinessController(snapshot),
      { initialProps: { snapshot: createMockSnapshot('Lazy readiness 0') } },
    );

    for (let index = 1; index <= 50; index += 1) {
      rerender({ snapshot: createMockSnapshot(`Lazy readiness ${index}`) });
    }

    expect(handoffSpy).not.toHaveBeenCalled();
    expect(readinessSpy).not.toHaveBeenCalled();
    expect(diagnosticsSpy).not.toHaveBeenCalled();

    handoffSpy.mockRestore();
    readinessSpy.mockRestore();
    diagnosticsSpy.mockRestore();
  });

  it('runs each getter only when requested', () => {
    const handoffSpy = vi.spyOn(engineModule, 'buildExportHandoff');
    const readinessSpy = vi.spyOn(engineModule, 'buildExportReadiness');
    const diagnosticsSpy = vi.spyOn(diagnosticsModule, 'buildDiagnosticSummary');

    const { result } = renderHook(() => useExportReadinessController(createMraidSnapshot()));

    expect(result.current.getHandoff().mraid).toBeTruthy();
    expect(result.current.getReadiness().targetChannel).toBe('mraid');
    expect(result.current.getDiagnostics().widgets).toBe(0);

    expect(handoffSpy).toHaveBeenCalledTimes(1);
    expect(readinessSpy).toHaveBeenCalledTimes(1);
    expect(diagnosticsSpy).toHaveBeenCalledTimes(1);

    handoffSpy.mockRestore();
    readinessSpy.mockRestore();
    diagnosticsSpy.mockRestore();
  });
});

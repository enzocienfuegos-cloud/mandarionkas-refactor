import { validateExport } from '../domain/document/export-validation';
import type { StudioState } from '../domain/document/types';
import { getChannelRequirements } from './channels';
import type { ExportManifest } from './types';

export function buildExportManifest(state: StudioState): ExportManifest {
  const issues = validateExport(state);
  return {
    documentId: state.document.id,
    documentName: state.document.name,
    exportedAt: new Date().toISOString(),
    canvas: { ...state.document.canvas },
    activeVariant: state.ui.activeVariant,
    activeFeedSource: state.ui.activeFeedSource,
    activeFeedRecordId: state.ui.activeFeedRecordId,
    sceneCount: state.document.scenes.length,
    widgetCount: Object.keys(state.document.widgets).length,
    actionCount: Object.keys(state.document.actions).length,
    targetChannel: state.document.metadata.release.targetChannel,
    qaStatus: state.document.metadata.release.qaStatus,
    issues,
    channelChecklist: getChannelRequirements(state.document.metadata.release.targetChannel, state),
  };
}

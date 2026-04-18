import { validateExport } from '../domain/document/export-validation';
import type { StudioState } from '../domain/document/types';
import { getExportChannelProfile } from './adapters';
import { getChannelRequirements } from './channels';
import { buildMraidHandoff } from './mraid-handoff';
import type { ExportManifest } from './types';

export function buildExportManifest(state: StudioState): ExportManifest {
  const issues = validateExport(state);
  const channelProfile = getExportChannelProfile(state.document.metadata.release.targetChannel);
  const mraidHandoff = state.document.metadata.release.targetChannel === 'mraid' ? buildMraidHandoff(state) : null;
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
    channelProfile: {
      id: channelProfile.id,
      label: channelProfile.label,
      family: channelProfile.family,
      deliveryMode: channelProfile.deliveryMode,
      exitStrategy: channelProfile.exitStrategy,
      supportedSizes: channelProfile.supportedSizes,
    },
    qaStatus: state.document.metadata.release.qaStatus,
    issues,
    channelChecklist: getChannelRequirements(state.document.metadata.release.targetChannel, state),
    handoff: mraidHandoff ? { mraid: mraidHandoff } : undefined,
  };
}

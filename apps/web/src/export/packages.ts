import type { StudioState } from '../domain/document/types';
import { getExportChannelProfile } from './adapters';
import { buildStandaloneHtml } from './html';
import { buildExportManifest } from './manifest';
import { buildMraidHandoff } from './mraid-handoff';
import { buildExportReadiness } from './readiness';

export function buildPublishPackage(state: StudioState): string {
  const channelProfile = getExportChannelProfile(state.document.metadata.release.targetChannel);
  const mraidHandoff = channelProfile.id === 'mraid' ? buildMraidHandoff(state) : null;
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    channel: {
      id: channelProfile.id,
      label: channelProfile.label,
      family: channelProfile.family,
      deliveryMode: channelProfile.deliveryMode,
      exitStrategy: channelProfile.exitStrategy,
      supportedSizes: channelProfile.supportedSizes,
      recommendedSceneCount: channelProfile.recommendedSceneCount,
    },
    manifest: buildExportManifest(state),
    readiness: buildExportReadiness(state),
    handoff: mraidHandoff ? { mraid: mraidHandoff } : undefined,
    collaboration: state.document.collaboration,
    document: state.document,
    html: buildStandaloneHtml(state),
  }, null, 2);
}

export function buildReviewPackage(state: StudioState): string {
  const channelProfile = getExportChannelProfile(state.document.metadata.release.targetChannel);
  const mraidHandoff = channelProfile.id === 'mraid' ? buildMraidHandoff(state) : null;
  const openComments = state.document.collaboration.comments.filter((item) => item.status === 'open');
  const pendingApprovals = state.document.collaboration.approvals.filter((item) => item.status === 'pending');
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    channel: {
      id: channelProfile.id,
      label: channelProfile.label,
      family: channelProfile.family,
      deliveryMode: channelProfile.deliveryMode,
      exitStrategy: channelProfile.exitStrategy,
      supportedSizes: channelProfile.supportedSizes,
      recommendedSceneCount: channelProfile.recommendedSceneCount,
    },
    document: { id: state.document.id, name: state.document.name },
    activeSceneId: state.document.selection.activeSceneId,
    summary: {
      openComments: openComments.length,
      pendingApprovals: pendingApprovals.length,
    },
    collaboration: state.document.collaboration,
    readiness: buildExportReadiness(state),
    manifest: buildExportManifest(state),
    handoff: mraidHandoff ? { mraid: mraidHandoff } : undefined,
  }, null, 2);
}

import { useState } from 'react';
import { shallowEqual, useStudioStore, useStudioStoreSnapshot } from '../../../core/store/use-studio-store';
import { resolveNextSceneId } from '../../../domain/document/resolvers';
import type { ApprovalStatus, CommentStatus, StudioState } from '../../../domain/document/types';
import { usePlatformSnapshot } from '../../../platform/runtime';
import { usePlaybackMsThrottled } from '../../../hooks/use-playback-engine';

export type DocumentInspectorTab = 'overview' | 'data' | 'collab';

export function useDocumentInspectorTab(initial: DocumentInspectorTab | string = 'overview') {
  return useState<string>(initial);
}

function useDocumentInspectorSharedContext() {
  const state = useStudioStoreSnapshot();
  const snapshot = useStudioStore((current) => ({
    document: current.document,
    lastAction: current.ui.lastTriggeredActionLabel,
    activeVariant: current.ui.activeVariant,
  }), shallowEqual);
  const document = snapshot.document;
  const lastAction = snapshot.lastAction;
  const activeVariant = snapshot.activeVariant;
  const activeSceneId = state.document.selection.activeSceneId;
  const activeScene = document.scenes.find((scene) => scene.id === activeSceneId) ?? document.scenes[0];
  const nextSceneId = activeScene ? resolveNextSceneId(state, activeScene.id) : undefined;
  const platformState = usePlatformSnapshot();
  const activeClient = platformState.clients.find((client) => client.id === platformState.session.activeClientId);
  const currentUser = platformState.session.currentUser;

  return {
    document,
    lastAction,
    activeVariant,
    activeScene,
    nextSceneId,
    activeClient,
    currentUser,
  };
}

export function useDocumentInspectorContext() {
  return useDocumentInspectorSharedContext();
}

export function useDocumentInspectorContextWithPlayhead() {
  const context = useDocumentInspectorSharedContext();
  const storePlayheadMs = useStudioStore((current) => current.ui.playheadMs);
  const playheadMs = usePlaybackMsThrottled(storePlayheadMs);
  return {
    ...context,
    playheadMs,
  };
}

export function commentAnchorLabel(anchor: { type: 'document' | 'scene' | 'widget'; targetId?: string }, state: StudioState): string {
  if (anchor.type === 'document') return 'Document';
  if (anchor.type === 'scene') return state.document.scenes.find((scene) => scene.id === anchor.targetId)?.name ?? 'Scene';
  if (anchor.type === 'widget') return state.document.widgets[anchor.targetId ?? '']?.name ?? 'Widget';
  return 'Target';
}

export function statusButtonLabel(status: CommentStatus): string {
  return status === 'open' ? 'Resolve' : 'Reopen';
}

export function nextCommentStatus(status: CommentStatus): CommentStatus {
  return status === 'open' ? 'resolved' : 'open';
}

export function nextApprovalStatus(status: ApprovalStatus): ApprovalStatus {
  if (status === 'pending') return 'approved';
  if (status === 'approved') return 'changes-requested';
  return 'pending';
}

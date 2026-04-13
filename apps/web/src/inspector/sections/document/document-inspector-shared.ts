import { useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { resolveNextSceneId } from '../../../domain/document/resolvers';
import type { ApprovalStatus, CommentStatus, StudioState } from '../../../domain/document/types';
import { usePlatformSnapshot } from '../../../platform/runtime';

export type DocumentInspectorTab = 'overview' | 'data' | 'release' | 'collab';

export function useDocumentInspectorTab(initial: DocumentInspectorTab = 'overview') {
  return useState<DocumentInspectorTab>(initial);
}

export function useDocumentInspectorContext() {
  const state = useStudioStore((value) => value);
  const document = state.document;
  const playheadMs = state.ui.playheadMs;
  const lastAction = state.ui.lastTriggeredActionLabel;
  const activeVariant = state.ui.activeVariant;
  const activeSceneId = state.document.selection.activeSceneId;
  const activeScene = document.scenes.find((scene) => scene.id === activeSceneId) ?? document.scenes[0];
  const nextSceneId = activeScene ? resolveNextSceneId(state, activeScene.id) : undefined;
  const platformState = usePlatformSnapshot();
  const activeClient = platformState.clients.find((client) => client.id === platformState.session.activeClientId);
  const currentUser = platformState.session.currentUser;

  return {
    document,
    playheadMs,
    lastAction,
    activeVariant,
    activeScene,
    nextSceneId,
    activeClient,
    currentUser,
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

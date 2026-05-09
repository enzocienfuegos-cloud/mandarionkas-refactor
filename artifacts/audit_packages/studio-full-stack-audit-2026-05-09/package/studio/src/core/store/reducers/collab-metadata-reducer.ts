import type { StudioCommand } from '../../commands/types';
import type { StudioState } from '../../../domain/document/types';
import { createApprovalId, createCommentId, withDirty } from '../store-utils';

export function collabMetadataReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'ADD_COMMENT': {
      const comment = {
        id: createCommentId(),
        author: command.author ?? 'Reviewer',
        message: command.message,
        createdAt: new Date().toISOString(),
        status: 'open' as const,
        anchor: command.anchor,
      };
      return withDirty({
        ...state,
        document: {
          ...state.document,
          collaboration: {
            ...state.document.collaboration,
            comments: [comment, ...state.document.collaboration.comments],
          },
        },
      });
    }
    case 'UPDATE_COMMENT_STATUS':
      return withDirty({
        ...state,
        document: {
          ...state.document,
          collaboration: {
            ...state.document.collaboration,
            comments: state.document.collaboration.comments.map((comment) => comment.id === command.commentId ? { ...comment, status: command.status } : comment),
          },
        },
      });
    case 'DELETE_COMMENT':
      return withDirty({
        ...state,
        document: {
          ...state.document,
          collaboration: {
            ...state.document.collaboration,
            comments: state.document.collaboration.comments.filter((comment) => comment.id !== command.commentId),
          },
        },
      });
    case 'ADD_APPROVAL_REQUEST': {
      const approval = {
        id: createApprovalId(),
        label: command.label,
        requestedBy: command.requestedBy ?? 'Studio',
        requestedAt: new Date().toISOString(),
        status: 'pending' as const,
      };
      return withDirty({
        ...state,
        document: {
          ...state.document,
          collaboration: {
            ...state.document.collaboration,
            approvals: [approval, ...state.document.collaboration.approvals],
          },
        },
      });
    }
    case 'UPDATE_APPROVAL_STATUS':
      return withDirty({
        ...state,
        document: {
          ...state.document,
          collaboration: {
            ...state.document.collaboration,
            approvals: state.document.collaboration.approvals.map((approval) => approval.id === command.approvalId ? { ...approval, status: command.status, reviewer: command.reviewer ?? approval.reviewer, note: command.note ?? approval.note } : approval),
          },
        },
      });
    case 'SET_SHARE_LINK':
      return withDirty({
        ...state,
        document: {
          ...state.document,
          collaboration: {
            ...state.document.collaboration,
            shareLink: command.shareLink,
          },
        },
      });
    case 'UPDATE_DOCUMENT_PLATFORM_METADATA':
      return withDirty({
        ...state,
        document: {
          ...state.document,
          metadata: {
            ...state.document.metadata,
            platform: {
              ...(state.document.metadata.platform ?? {}),
              ...command.patch,
            },
          },
        },
      });
    case 'UPDATE_RELEASE_SETTINGS':
      return withDirty({
        ...state,
        document: {
          ...state.document,
          metadata: {
            ...state.document.metadata,
            release: {
              ...state.document.metadata.release,
              ...command.patch,
            },
          },
        },
      });
    case 'MARK_DOCUMENT_SAVED':
      return {
        ...state,
        document: {
          ...state.document,
          metadata: {
            ...state.document.metadata,
            dirty: false,
            lastSavedAt: command.at,
          },
        },
      };
    case 'MARK_DOCUMENT_AUTOSAVED':
      return {
        ...state,
        document: {
          ...state.document,
          metadata: {
            ...state.document.metadata,
            lastAutosavedAt: command.at,
          },
        },
      };
    default:
      return state;
  }
}

import type { CollaborationController, TopBarStudioSnapshot } from './top-bar-types';

export function useCollaborationController(snapshot: TopBarStudioSnapshot): CollaborationController {
  return {
    openComments: snapshot.state.document.collaboration.comments.filter((item) => item.status === 'open').length,
    pendingApprovals: snapshot.state.document.collaboration.approvals.filter((item) => item.status === 'pending').length,
  };
}

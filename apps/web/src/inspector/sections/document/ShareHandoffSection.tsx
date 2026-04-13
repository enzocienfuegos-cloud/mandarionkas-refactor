import { useStudioStore } from '../../../core/store/use-studio-store';
import { triggerExportReviewPackage } from '../../../export/engine';
import { useDocumentActions } from '../../../hooks/use-studio-actions';

export function ShareHandoffSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const { setShareLink } = useDocumentActions();
  const shareLink = state.document.collaboration.shareLink ?? `smx://review/${state.document.id}`;
  const openComments = state.document.collaboration.comments.filter((item) => item.status === 'open').length;
  const pendingApprovals = state.document.collaboration.approvals.filter((item) => item.status === 'pending').length;

  return (
    <div className="field-stack">
      <div className="meta-line">
        <span className="pill">Open comments {openComments}</span>
        <span className="pill">Pending approvals {pendingApprovals}</span>
      </div>
      <div>
        <label>Share link</label>
        <input value={shareLink} onChange={(event) => setShareLink(event.target.value)} />
      </div>
      <div className="meta-line">
        <button onClick={() => navigator.clipboard?.writeText(shareLink)}>Copy link</button>
        <button onClick={() => triggerExportReviewPackage(state)}>Export review package</button>
      </div>
      <small className="muted">Review and handoff stay document-level concerns, separate from the widget inspector and canvas runtime.</small>
    </div>
  );
}

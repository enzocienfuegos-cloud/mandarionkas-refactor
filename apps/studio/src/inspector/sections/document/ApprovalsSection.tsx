import { useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { useCollaborationActions } from '../../../hooks/use-studio-actions';
import { nextApprovalStatus } from './document-inspector-shared';

export function ApprovalsSection(): JSX.Element {
  const approvals = useStudioStore((state) => state.document.collaboration.approvals);
  const { addApprovalRequest, updateApprovalStatus } = useCollaborationActions();
  const [label, setLabel] = useState('Creative review');

  return (
    <div className="field-stack">
      <div className="meta-line">
        <span className="pill">Pending {approvals.filter((item) => item.status === 'pending').length}</span>
        <span className="pill">Approved {approvals.filter((item) => item.status === 'approved').length}</span>
        <span className="pill">Changes {approvals.filter((item) => item.status === 'changes-requested').length}</span>
      </div>
      <div className="meta-line">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Approval label" />
        <button onClick={() => addApprovalRequest(label.trim() || 'Creative review', 'Studio')}>Request</button>
      </div>
      <div className="field-stack">
        {approvals.length ? approvals.map((approval) => (
          <div key={approval.id} className="comment-card">
            <div className="meta-line" style={{ justifyContent: 'space-between' }}>
              <strong>{approval.label}</strong>
              <span className="pill">{approval.status}</span>
            </div>
            <small className="muted">Requested by {approval.requestedBy} · {new Date(approval.requestedAt).toLocaleString()}</small>
            {approval.note ? <div>{approval.note}</div> : null}
            <div className="meta-line">
              <button onClick={() => updateApprovalStatus(approval.id, nextApprovalStatus(approval.status), 'Reviewer')}>Advance status</button>
              <button className="ghost" onClick={() => updateApprovalStatus(approval.id, 'changes-requested', 'Reviewer', 'Needs another pass')}>Request changes</button>
            </div>
          </div>
        )) : <div className="pill">No approval requests yet</div>}
      </div>
    </div>
  );
}

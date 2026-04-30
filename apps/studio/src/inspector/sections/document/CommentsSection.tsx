import { useState } from 'react';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { useCollaborationActions } from '../../../hooks/use-studio-actions';
import { commentAnchorLabel, nextCommentStatus, statusButtonLabel } from './document-inspector-shared';

export function CommentsSection(): JSX.Element {
  const state = useStudioStore((value) => value);
  const { addComment, updateCommentStatus, deleteComment } = useCollaborationActions();
  const activeSceneId = state.document.selection.activeSceneId;
  const selectedWidgetId = state.document.selection.primaryWidgetId;
  const [message, setMessage] = useState('');
  const [anchorType, setAnchorType] = useState<'document' | 'scene' | 'widget'>(selectedWidgetId ? 'widget' : 'document');
  const comments = state.document.collaboration.comments;
  const openCount = comments.filter((item) => item.status === 'open').length;
  const targetId = anchorType === 'scene' ? activeSceneId : anchorType === 'widget' ? selectedWidgetId : undefined;

  return (
    <div className="field-stack">
      <div className="meta-line"><span className="pill">Open {openCount}</span><span className="pill">Total {comments.length}</span></div>
      <div className="fields-grid">
        <div>
          <label>Anchor</label>
          <select value={anchorType} onChange={(event) => setAnchorType(event.target.value as 'document' | 'scene' | 'widget')}>
            <option value="document">Document</option>
            <option value="scene">Scene</option>
            <option value="widget" disabled={!selectedWidgetId}>Widget</option>
          </select>
        </div>
        <div><label>Author</label><input value="Reviewer" readOnly /></div>
      </div>
      <div>
        <label>Comment</label>
        <textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Leave review feedback, QA notes or handoff comments..." />
      </div>
      <button className="primary" disabled={!message.trim()} onClick={() => { addComment({ type: anchorType, targetId }, message.trim(), 'Reviewer'); setMessage(''); }}>Add comment</button>
      <div className="field-stack">
        {comments.length ? comments.map((comment) => (
          <div key={comment.id} className="comment-card">
            <div className="meta-line" style={{ justifyContent: 'space-between' }}>
              <strong>{comment.author}</strong>
              <span className="pill">{comment.status}</span>
            </div>
            <small className="muted">{commentAnchorLabel(comment.anchor, state)} · {new Date(comment.createdAt).toLocaleString()}</small>
            <div>{comment.message}</div>
            <div className="meta-line">
              <button onClick={() => updateCommentStatus(comment.id, nextCommentStatus(comment.status))}>{statusButtonLabel(comment.status)}</button>
              <button className="ghost" onClick={() => deleteComment(comment.id)}>Delete</button>
            </div>
          </div>
        )) : <div className="pill">No comments yet</div>}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useStudioStoreSnapshot } from '../../../core/store/use-studio-store';
import { useCollaborationActions } from '../../../hooks/use-studio-actions';
import { createInspectorField } from '../../contract-driven';
import { Button } from '../../../shared/ui/Button';
import { commentAnchorLabel, nextCommentStatus, statusButtonLabel } from './document-inspector-shared';

export function CommentsSection(): JSX.Element {
  const state = useStudioStoreSnapshot();
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
        {createInspectorField({
          kind: 'select',
          label: 'Anchor',
          value: anchorType,
          onChange: (value) => setAnchorType(value as 'document' | 'scene' | 'widget'),
          options: [
            { label: 'Document', value: 'document' },
            { label: 'Scene', value: 'scene' },
            { label: 'Widget', value: 'widget', disabled: !selectedWidgetId },
          ],
        })}
        {createInspectorField({
          kind: 'text',
          label: 'Author',
          value: 'Reviewer',
          readOnly: true,
          onChange: () => undefined,
        })}
      </div>
      {createInspectorField({
        kind: 'textarea',
        label: 'Comment',
        rows: 3,
        value: message,
        placeholder: 'Leave review feedback, QA notes or handoff comments...',
        onChange: setMessage,
      })}
      <Button variant="primary" disabled={!message.trim()} onClick={() => { addComment({ type: anchorType, targetId }, message.trim(), 'Reviewer'); setMessage(''); }}>Add comment</Button>
      <div className="field-stack">
        {comments.length ? comments.map((comment) => (
          <div key={comment.id} className="comment-card">
            <div className="meta-line meta-line--between">
              <strong>{comment.author}</strong>
              <span className="pill">{comment.status}</span>
            </div>
            <small className="muted">{commentAnchorLabel(comment.anchor, state)} · {new Date(comment.createdAt).toLocaleString()}</small>
            <div>{comment.message}</div>
            <div className="meta-line">
              <Button size="sm" onClick={() => updateCommentStatus(comment.id, nextCommentStatus(comment.status))}>{statusButtonLabel(comment.status)}</Button>
              <Button variant="ghost" size="sm" onClick={() => deleteComment(comment.id)}>Delete</Button>
            </div>
          </div>
        )) : <div className="pill">No comments yet</div>}
      </div>
    </div>
  );
}

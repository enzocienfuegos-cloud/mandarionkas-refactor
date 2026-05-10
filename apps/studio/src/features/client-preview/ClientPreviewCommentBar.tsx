import { useMemo, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { formatRelativeTime } from './use-client-preview';
import type { ClientPreviewThread } from './types';

function sortComments(thread: ClientPreviewThread) {
  return [...thread.comments].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function ClientPreviewCommentBar({
  sceneLabel,
  threads,
  activeThreadId,
  replyThreadId,
  pinMode,
  onSelectThread,
  onAddComment,
  onStartReply,
  onCancelReply,
  onTogglePinMode,
}: {
  sceneLabel: string;
  threads: ClientPreviewThread[];
  activeThreadId: string | null;
  replyThreadId: string | null;
  pinMode: boolean;
  onSelectThread(threadId: string): void;
  onAddComment(body: string): void;
  onStartReply(threadId: string, parentId?: string): void;
  onCancelReply(): void;
  onTogglePinMode(): void;
}): JSX.Element {
  const [draft, setDraft] = useState('');
  const visibleThreads = useMemo(() => threads.filter((thread) => thread.comments.length || thread.pin), [threads]);

  return (
    <section className="cp-comment-bar">
      <div className="cp-comment-bar-head">
        <div>
          <h4>Comentarios</h4>
          <small className="muted">{sceneLabel}</small>
        </div>
        <Button variant={pinMode ? 'primary' : 'ghost'} size="sm" onClick={onTogglePinMode}>
          {pinMode ? 'Cancelar pin' : '+ Agregar'}
        </Button>
      </div>

      <div className="cp-comments-list">
        {visibleThreads.map((thread) => {
          const comments = sortComments(thread);
          return (
            <article
              key={thread.id}
              className={`cp-thread ${activeThreadId === thread.id ? 'is-active' : ''}`.trim()}
              onClick={() => onSelectThread(thread.id)}
            >
              <div className="cp-thread-head">
                <span className="cp-thread-pin">
                  {thread.pin ? `Pin ${Math.round(thread.pin.xPct)}%, ${Math.round(thread.pin.yPct)}%` : 'Comentario general'}
                </span>
                <span className="pill">{comments.length} mensaje{comments.length === 1 ? '' : 's'}</span>
              </div>
              {comments.map((comment) => (
                <div key={comment.id} className={`cp-comment ${comment.parentId ? 'reply' : ''}`.trim()}>
                  <div className="cp-comment-avatar" style={{ background: comment.authorColor }}>
                    {comment.authorInitials}
                  </div>
                  <div className="cp-comment-body">
                    <div className="cp-comment-meta">
                      <span className="cp-comment-author">{comment.authorName}</span>
                      <span className="cp-comment-time">{formatRelativeTime(comment.createdAt)}</span>
                    </div>
                    <div className="cp-comment-text">{comment.body}</div>
                    <div className="cp-comment-actions">
                      <button type="button" className="cp-reply-btn" onClick={(event) => {
                        event.stopPropagation();
                        onStartReply(thread.id, comment.id);
                      }}
                      >
                        Responder
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </article>
          );
        })}

        {!visibleThreads.length ? (
          <div className="story-flow-canvas-hint">Todavia no hay comentarios en esta escena.</div>
        ) : null}
      </div>

      <form
        className="cp-new-comment"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (!trimmed) return;
          onAddComment(trimmed);
          setDraft('');
        }}
      >
        <textarea
          className="cp-new-comment-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={replyThreadId ? 'Escribe una respuesta...' : pinMode ? 'Activa el pin y haz click en el banner, o deja un comentario general...' : 'Deja un comentario...'}
        />
        <div className="cp-comment-actions">
          {replyThreadId ? <Button variant="ghost" size="sm" onClick={onCancelReply}>Cancelar</Button> : null}
          <Button variant="primary" size="sm" type="submit">Enviar</Button>
        </div>
      </form>
    </section>
  );
}

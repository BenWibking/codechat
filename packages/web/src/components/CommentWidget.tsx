import { Button } from './Button';
import { useState } from 'react';
import { useReview } from '../context/ReviewContext';
import { isLineRange, type Comment } from '../types';

export function CommentWidget({ comments, onReply }: { comments: Comment[]; onReply: () => void }) {
  const { send } = useReview();
  const [editing, setEditing] = useState<string | null>(null);
  const [body, setBody] = useState('');
  if (!comments.length) return null;
  return <div className="annotation-card review-controls">
    <span className="comment-avatar" aria-hidden="true">Y</span>
    <div className="min-w-0 flex-1">
      {comments.map((comment) => <article key={comment.id} className="comment-thread">
        <div className="flex items-center gap-2"><strong>You</strong><small>{comment.resolved ? 'Resolved' : 'Pending'}</small>
          {isLineRange(comment) && <small>Lines {comment.line}–{comment.endLine}</small>}</div>
        {editing === comment.id ? <form onSubmit={(event) => {
          event.preventDefault();
          if (body.trim()) { send({ type: 'edit_comment', data: { id: comment.id, body: body.trim() } }); setEditing(null); }
        }}>
          <textarea aria-label="Edit comment" autoFocus value={body} onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null); }} />
          <Button variant="outline" size="xs" type="submit" disabled={!body.trim()}>Save</Button><Button variant="outline" size="xs" type="button" onClick={() => setEditing(null)}>Cancel</Button>
        </form> : <p className="whitespace-pre-wrap">{comment.body}</p>}
        {comment.agentReply && <div className="agent-reply"><strong>Agent</strong><p className="whitespace-pre-wrap">{comment.agentReply}</p></div>}
        {!comment.resolved && !comment.agentReply && editing !== comment.id && <div className="flex gap-2 mt-2">
          <Button variant="outline" size="xs" onClick={() => { setEditing(comment.id); setBody(comment.body); }}>Edit</Button>
          <Button variant="outline" size="xs" onClick={() => send({ type: 'delete_comment', data: { id: comment.id } })}>Delete</Button>
        </div>}
      </article>)}
      <Button variant="outline" size="xs" onClick={onReply}>Reply</Button>
    </div>
  </div>;
}

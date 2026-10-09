import { Button } from './Button';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReview } from '../context/ReviewContext';
import { isLineRange, type Comment } from '../types';

interface CommentWidgetProps {
  comments: Comment[];
  /** Draft form rendered at the bottom of the thread (new thread or reply). */
  children?: ReactNode;
  onReply: () => void;
}

/** A GitHub-style review thread: stacked comments, agent replies, and a reply box. */
export function CommentWidget({ comments, children, onReply }: CommentWidgetProps) {
  const { state } = useReview();
  const allResolved = comments.length > 0 && comments.every((comment) => comment.resolved);
  const [expanded, setExpanded] = useState(!allResolved);
  if (!comments.length && !children) return null;
  const anchor = comments[0];

  return <div className="gh-thread review-controls">
    {anchor && (allResolved || isLineRange(anchor)) && <div className="gh-thread-header">
      {allResolved && <button type="button" className="gh-thread-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <Chevron open={expanded} />
        <span>This conversation was marked as resolved</span>
      </button>}
      {!allResolved && isLineRange(anchor) && <span>{rangeLabel(anchor)}</span>}
    </div>}
    {(expanded || !allResolved) && <>
      {comments.map((comment) => <CommentEntry key={comment.id} comment={comment} />)}
      {children ? <div className="gh-thread-compose">{children}</div>
        : comments.length > 0 && !allResolved && <div className="gh-thread-reply">
          <Avatar kind="user" small />
          <button type="button" className="gh-reply-input" disabled={!!state.activeDraft}
            title={state.activeDraft ? 'Finish your open comment first' : undefined} onClick={onReply}>Reply…</button>
        </div>}
    </>}
  </div>;
}

function CommentEntry({ comment }: { comment: Comment }) {
  const { send } = useReview();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState('');
  const editable = !comment.resolved && !comment.agentReply;

  function save() {
    if (!body.trim()) return;
    send({ type: 'edit_comment', data: { id: comment.id, body: body.trim() } });
    setEditing(false);
  }

  return <>
    <article className="gh-comment">
      <Avatar kind="user" />
      <div className="gh-comment-main">
        <div className="gh-comment-header">
          <strong>You</strong>
          <time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString()}>{timeAgo(comment.createdAt)}</time>
          <span className={`gh-label ${comment.resolved ? 'gh-label-resolved' : 'gh-label-pending'}`}>{comment.resolved ? 'Resolved' : 'Pending'}</span>
          {editable && !editing && <CommentMenu onEdit={() => { setBody(comment.body); setEditing(true); }}
            onDelete={() => send({ type: 'delete_comment', data: { id: comment.id } })} />}
        </div>
        {editing ? <form className="gh-compose" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <textarea className="gh-textarea" aria-label="Edit comment" autoFocus rows={3} value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); save(); }
              if (event.key === 'Escape') setEditing(false);
            }} />
          <div className="gh-compose-actions">
            <Button variant="outline" size="sm" type="button" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" type="submit" className="gh-btn-primary" disabled={!body.trim()}>Update comment</Button>
          </div>
        </form> : <div className="gh-comment-body">{comment.body}</div>}
      </div>
    </article>
    {comment.agentReply && <article className="gh-comment">
      <Avatar kind="agent" />
      <div className="gh-comment-main">
        <div className="gh-comment-header">
          <strong>Agent</strong>
          <span className="gh-label">bot</span>
        </div>
        <div className="gh-comment-body">{comment.agentReply}</div>
      </div>
    </article>}
  </>;
}

function CommentMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!event.composedPath().includes(ref.current!)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  return <div ref={ref} className="gh-menu">
    <button type="button" className="gh-icon-button" aria-label="Comment actions" aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen((value) => !value)}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" />
      </svg>
    </button>
    {open && <div role="menu" className="gh-menu-list animate-fade-in">
      <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }}>Edit</button>
      <button type="button" role="menuitem" className="gh-menu-danger" onClick={() => { setOpen(false); onDelete(); }}>Delete</button>
    </div>}
  </div>;
}

export function Avatar({ kind, small }: { kind: 'user' | 'agent'; small?: boolean }) {
  return <span className={`gh-avatar gh-avatar-${kind}${small ? ' gh-avatar-small' : ''}`} aria-hidden="true">
    {kind === 'user' ? 'Y' : <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2.5" y="5" width="11" height="8" rx="2" /><path d="M8 5V2.5M6 9h.01M10 9h.01" />
    </svg>}
  </span>;
}

function Chevron({ open }: { open: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
    style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}>
    <path d="M6 3.5 10.5 8 6 12.5z" />
  </svg>;
}

export function rangeLabel(item: { line: number; endLine?: number; side: 'old' | 'new' }) {
  const sign = item.side === 'old' ? '-' : '+';
  return `Comment on lines ${sign}${item.line} to ${sign}${item.endLine}`;
}

function timeAgo(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'just now';
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['minute', 60], ['hour', 60], ['day', 24], ['month', 30], ['year', 12]];
  let value = seconds;
  for (let i = 0; i < steps.length; i++) {
    value /= steps[i][1];
    if (i === steps.length - 1 || value < steps[i + 1][1]) return format.format(-Math.floor(value), steps[i][0]);
  }
  return '';
}

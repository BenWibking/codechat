import { Button } from './Button';
import { useRef, useEffect } from 'react';
import { useReview } from '../context/ReviewContext';
import { isLineRange } from '../types';
import { Avatar, rangeLabel } from './CommentWidget';

interface CommentFormProps {
  filePath: string;
  line: number;
  endLine?: number;
  side: 'old' | 'new';
  /** True when replying inside an existing thread. */
  isReply?: boolean;
  onCancel: () => void;
}

export function CommentForm({ filePath, line, endLine, side, isReply, onCancel }: CommentFormProps) {
  const { state, send, updateDraft } = useReview();
  const body = state.activeDraft?.filePath === filePath ? (state.activeDraft.body ?? '') : '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    send({
      type: 'add_comment',
      data: { filePath, line, ...(endLine ? { endLine } : {}), side, body: trimmed },
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  }

  const shortcut = /(Mac|iPhone|iPad)/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

  return (
    <div className="gh-compose-row">
      <Avatar kind="user" />
      <form className="gh-compose" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {!isReply && isLineRange({ line, endLine }) && (
          <div className="gh-compose-range">{rangeLabel({ line, endLine, side })}</div>
        )}
        <textarea
          ref={textareaRef}
          className="gh-textarea"
          aria-label={isReply ? 'Reply' : 'Comment'}
          value={body}
          onChange={(e) => updateDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isReply ? 'Reply…' : 'Leave a comment'}
          rows={4}
        />
        <div className="gh-compose-actions">
          <span className="gh-compose-hint">{shortcut}+Enter to submit</span>
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>Cancel</Button>
          <Button size="sm" type="submit" className="gh-btn-primary" disabled={!body.trim()}>
            {isReply ? 'Reply' : 'Add comment'}
          </Button>
        </div>
      </form>
    </div>
  );
}

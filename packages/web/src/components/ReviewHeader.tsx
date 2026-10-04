import { Button } from './Button';
import { useState } from 'react';
import { useReview } from '../context/ReviewContext';
import { useTheme } from '../hooks/useTheme';
import { SubmitDialog } from './SubmitDialog';

export function ReviewHeader() {
  const { state } = useReview();
  const { theme, toggleTheme } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const session = state.session;
  if (!session) return null;
  const pending = session.comments.filter((comment) => !comment.resolved).length;
  return <>
    <header className="review-header review-controls">
      <strong>CodeChat</strong>
      <span className="repo-name" title={session.repoPath}>{session.repoPath.split('/').at(-1)}</span>
      <span className="diff-stats"><span className="added">+{session.files.reduce((sum, file) => sum + file.additions, 0)}</span>{' '}
        <span className="deleted">−{session.files.reduce((sum, file) => sum + file.deletions, 0)}</span></span>
      <span className="connection-status" role="status">{state.isConnected ? '● Agent connected' : '○ Reconnecting…'}</span>
      <Button variant="outline" size="xs" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme}>{theme === 'dark' ? 'Light' : 'Dark'}</Button>
      <Button variant="outline" size="xs" className="primary-button" onClick={() => setSubmitting(true)}>Submit review{pending ? ` (${pending})` : ''}</Button>
    </header>
    {session.description && <div className="review-description">{session.description}</div>}
    {submitting && <SubmitDialog onClose={() => setSubmitting(false)} />}
  </>;
}

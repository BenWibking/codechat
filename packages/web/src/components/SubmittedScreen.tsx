import { Button } from './Button';
import { useReview } from '../context/ReviewContext';

export function SubmittedScreen() {
  const { state } = useReview();
  const interrupted = state.session?.status === 'pending';
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ backgroundColor: 'var(--color-page-bg)' }}
    >
      <div className="text-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 16 16"
          fill="var(--color-success)"
          className="mx-auto mb-4"
        >
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
        <div className="mb-2 text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {interrupted ? 'Review paused' : 'Review submitted'}
        </div>
        <div className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {interrupted ? 'Your comments were saved. Ask the agent to reopen this review to continue.' : 'This window should close automatically.'}
        </div>
        <Button variant="outline" size="xs"
          onClick={() => window.close()}
          className="rounded-md px-4 py-1.5 text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-bg)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          Close window
        </Button>
      </div>
    </div>
  );
}

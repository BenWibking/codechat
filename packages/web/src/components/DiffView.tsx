import { Button } from './Button';
import { useState, useMemo, useEffect, useRef } from 'react';
import { CodeView, type CodeViewHandle } from '@pierre/diffs/react';
import type { CodeViewItem, CodeViewLineSelection, DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs';
import { useReview } from '../context/ReviewContext';
import { useTheme } from '../hooks/useTheme';
import { CommentWidget } from './CommentWidget';
import { CommentForm } from './CommentForm';
import { FileHeader } from './FileHeader';
import { toPierreDiff, hasLine } from '../utils/pierreDiff';
import type { DiffPage } from '../utils/diffPages';
import type { Comment } from '../types';

interface DiffViewProps {
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}

export function DiffView({ activeFile, onSelectFile }: DiffViewProps) {
  const { state } = useReview();
  const [viewType, setViewType] = useState<'unified' | 'split'>('unified');
  const [showResolved, setShowResolved] = useState(true);
  const [loaded, setLoaded] = useState<{ key: string; data: DiffPage } | null>(null);
  const [message, setMessage] = useState('Loading file…');
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const summary = state.session?.files.find((file) => file.path === activeFile) ?? state.session?.files[0];
  const filePath = summary?.path;
  const revision = state.session?.revision;
  const key = `${revision}:${filePath}`;
  const url = `/api/file-diff?path=${encodeURIComponent(filePath ?? '')}&revision=${encodeURIComponent(revision ?? '')}`;
  const data = loaded?.key === key ? loaded.data : null;
  const comments = useMemo(() => state.session?.comments.filter((comment) => comment.filePath === filePath) ?? [], [state.session?.comments, filePath]);

  useEffect(() => {
    if (!filePath || !revision) return;
    setMessage('Loading file…'); setError(false); setCollapsed(false);
    const worker = new Worker(new URL('../diff.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      if (event.data.type === 'page') {
        setLoaded({ key, data: event.data.data }); setError(false);
        scrollRef.current?.scrollTo({ top: 0 });
      } else {
        setMessage(event.data.message); setError(event.data.type === 'error');
      }
    };
    worker.onerror = () => { setError(true); setMessage('Could not prepare this file. Retry or download its raw diff.'); };
    worker.postMessage({ type: 'load', url, ...(state.activeDraft?.filePath === filePath ? { line: state.activeDraft.endLine ?? state.activeDraft.line, side: state.activeDraft.side } : {}) });
    return () => { worker.terminate(); workerRef.current = null; };
  }, [filePath, revision, key, url]);

  if (!state.session || !summary) return <div className="p-6">No changed files.</div>;
  const resolvedCount = comments.filter((comment) => comment.resolved).length;
  const fileIndex = state.session.files.findIndex((file) => file.path === filePath);
  const requestPage = (page: number) => workerRef.current?.postMessage({ type: 'page', page });

  return (
    <div ref={scrollRef} className="review-controls flex flex-col flex-1 min-w-0 overflow-hidden" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      <div className="review-toolbar flex flex-wrap items-center gap-3 px-4 py-2">
        <Button variant="outline" size="xs" disabled={fileIndex === 0} onClick={() => onSelectFile(state.session!.files[fileIndex - 1].path)}>Previous file</Button>
        <span>File {fileIndex + 1} of {state.session.files.length}</span>
        <Button variant="outline" size="xs" disabled={fileIndex === state.session.files.length - 1} onClick={() => onSelectFile(state.session!.files[fileIndex + 1].path)}>Next file</Button>
        <Button variant="outline" size="xs" aria-pressed={viewType === 'unified'} onClick={() => setViewType('unified')}>Unified</Button>
        <Button variant="outline" size="xs" aria-pressed={viewType === 'split'} onClick={() => setViewType('split')}>Split</Button>
        {resolvedCount > 0 && <Button variant="outline" size="xs" onClick={() => setShowResolved((value) => !value)}>{showResolved ? 'Hide' : 'Show'} {resolvedCount} resolved</Button>}
        <a href={`${url}&download=1`} download>Download raw diff</a>
      </div>
      <FileHeader file={summary} commentCount={comments.length} isCollapsed={collapsed} isActive onToggle={() => setCollapsed((value) => !value)} />
      {comments.length > 0 && (
        <details className="p-3">
          <summary>{comments.length} comments in this file</summary>
          {comments.map((comment) => <div key={comment.id} className="py-1">
            <Button variant="outline" size="xs" disabled={!!state.activeDraft} onClick={() => workerRef.current?.postMessage({ type: 'page', line: comment.endLine ?? comment.line, side: comment.side })}>
              {comment.side} line {comment.line}{comment.endLine ? `–${comment.endLine}` : ''}: {comment.body}
            </Button>
          </div>)}
        </details>
      )}
      {!collapsed && (!data || error ? <div role={error ? 'alert' : 'status'} className="p-4">
        {message}
        {error && <Button variant="outline" size="xs" className="ml-3" onClick={() => workerRef.current?.postMessage({ type: 'load', url })}>Retry</Button>}
      </div> : <>
        {data.pageCount > 1 && <div className="review-toolbar flex flex-wrap items-center gap-3 py-3">
          <Button variant="outline" size="xs" disabled={data.page === 0 || !!state.activeDraft} onClick={() => requestPage(data.page - 1)}>Previous page</Button>
          <form className="flex items-center gap-2" onSubmit={(event) => {
            event.preventDefault();
            const page = Number(new FormData(event.currentTarget).get('page')) - 1;
            if (Number.isInteger(page) && page >= 0 && page < data.pageCount) requestPage(page);
          }}>
            <label>Page <input key={`${key}:${data.page}`} aria-label="Diff page" name="page" type="number"
              min={1} max={data.pageCount} defaultValue={data.page + 1} className="w-20" disabled={!!state.activeDraft} />
              {' '}of {data.pageCount} · {data.totalRows.toLocaleString()} diff lines</label>
            <Button variant="outline" size="xs" disabled={!!state.activeDraft} type="submit">Go</Button>
          </form>
          <Button variant="outline" size="xs" disabled={data.page === data.pageCount - 1 || !!state.activeDraft} onClick={() => requestPage(data.page + 1)}>Next page</Button>
        </div>}
        {data.file.hunks.length === 0 && <p className="p-4 text-sm">No textual changes to display. This file is empty, binary, or has only metadata changes.</p>}
        {data.omittedLines > 0 && <p role="status" className="py-3">{data.omittedLines} very long lines have preview placeholders. Download the raw diff for their complete content.</p>}
        <FileDiffSection key={`${key}:${data.page}`} file={data.file} filePath={filePath!} viewType={viewType}
          comments={comments} showResolved={showResolved} paged={data.pageCount > 1} />
        {data.pageCount > 1 && <div className="review-toolbar flex items-center gap-3 py-4">
          <Button variant="outline" size="xs" disabled={data.page === 0 || !!state.activeDraft} onClick={() => requestPage(data.page - 1)}>Previous page</Button>
          <span>Page {data.page + 1} of {data.pageCount}</span>
          <Button variant="outline" size="xs" disabled={data.page === data.pageCount - 1 || !!state.activeDraft} onClick={() => requestPage(data.page + 1)}>Next page</Button>
        </div>}
      </>)}
    </div>
  );
}

interface FileDiffSectionProps {
  file: DiffPage['file'];
  filePath: string;
  viewType: 'unified' | 'split';
  comments: Comment[];
  showResolved: boolean;
  paged: boolean;
}

type Annotation = { comments: Comment[]; draft: boolean };

function FileDiffSection({ file, filePath, viewType, comments, showResolved }: FileDiffSectionProps) {
  const { state, startDraft, discardDraft } = useReview();
  const { theme } = useTheme();
  const draft = state.activeDraft?.filePath === filePath ? state.activeDraft : null;
  const draftKey = draft ? `${draft.side}:${draft.line}:${draft.endLine}` : null;
  const version = useRef(0);
  const viewer = useRef<CodeViewHandle<Annotation, undefined> | null>(null);
  const [selection, setSelection] = useState<CodeViewLineSelection | null>(null);
  const fileDiff = useMemo(() => toPierreDiff(file, filePath), [file, filePath]);
  const annotations = useMemo(() => {
    const groups = new Map<string, DiffLineAnnotation<Annotation>>();
    for (const comment of comments) {
      if (!showResolved && comment.resolved) continue;
      const line = comment.endLine ?? comment.line;
      if (!hasLine(file, comment.side, line)) continue;
      const side = comment.side === 'old' ? 'deletions' : 'additions';
      const key = `${side}:${line}`;
      const group = groups.get(key) ?? { side, lineNumber: line, metadata: { comments: [], draft: false } };
      group.metadata.comments.push(comment);
      groups.set(key, group);
    }
    if (draft && hasLine(file, draft.side, draft.endLine ?? draft.line)) {
      const side = draft.side === 'old' ? 'deletions' : 'additions';
      const lineNumber = draft.endLine ?? draft.line;
      const key = `${side}:${lineNumber}`;
      const group = groups.get(key) ?? { side, lineNumber, metadata: { comments: [], draft: false } };
      group.metadata.draft = true;
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [comments, draftKey, file, showResolved]);
  const items = useMemo<CodeViewItem<Annotation>[]>(() => [{
    id: filePath, type: 'diff', fileDiff, annotations, version: ++version.current,
  }], [filePath, fileDiff, annotations]);
  useEffect(() => {
    const annotation = annotations.at(-1);
    if (annotation) viewer.current?.scrollTo({ type: 'line', id: filePath,
      lineNumber: annotation.lineNumber, side: annotation.side, align: 'center' });
  }, [items, filePath]);
  const createDraft = (range: SelectedLineRange | null) => {
    if (!range || state.activeDraft) return;
    // CodeChat anchors ranges to one side; mixed-side selections cannot be submitted.
    const side = range.side ?? 'additions';
    if (range.endSide && range.endSide !== side) return;
    const line = Math.min(range.start, range.end);
    const end = Math.max(range.start, range.end);
    startDraft(filePath, line, side === 'deletions' ? 'old' : 'new', end === line ? undefined : end);
  };
  // Recreate the bounded viewer when annotation slots change. Pierre 1.5.1 can
  // retain a stale virtual slot at the final line when a draft becomes a saved thread.
  return <CodeView<Annotation> key={items[0].version} ref={viewer}
    className="pierre-code-view"
    items={items}
    selectedLines={draft ? { id: filePath, range: {
      start: draft.line, end: draft.endLine ?? draft.line,
      side: draft.side === 'old' ? 'deletions' : 'additions',
    } } : selection}
    onSelectedLinesChange={setSelection}
    options={{
      theme: { light: 'pierre-light', dark: 'pierre-dark' }, themeType: theme,
      diffStyle: viewType, diffIndicators: 'bars', overflow: 'wrap',
      lineHoverHighlight: 'number', enableLineSelection: true, enableGutterUtility: true,
      stickyHeaders: true, disableFileHeader: true,
      layout: { paddingTop: 0, paddingBottom: 0, gap: 1 },
      onLineSelectionEnd: createDraft, onGutterUtilityClick: createDraft,
    }}
    renderAnnotation={(annotation) => <div className="review-annotation">
      <CommentWidget comments={annotation.metadata.comments} onReply={() => {
        if (state.activeDraft) return;
        const comment = annotation.metadata.comments[0];
        startDraft(filePath, comment.line, comment.side, comment.endLine);
      }} />
      {annotation.metadata.draft && draft && <CommentForm filePath={filePath} line={draft.line}
        endLine={draft.endLine} side={draft.side} onCancel={() => { discardDraft(); setSelection(null); }} />}
    </div>}
  />;
}

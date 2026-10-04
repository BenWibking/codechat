import { useEffect, useMemo, useState } from 'react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { useReview } from '../context/ReviewContext';

interface FileListProps {
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  width?: number;
}

export function FileList({ activeFile, onSelectFile, width = 288 }: FileListProps) {
  const { state } = useReview();
  const [query, setQuery] = useState('');
  const files = state.session?.files ?? [];
  const filtered = useMemo(() => files.filter((file) => file.path.toLowerCase().includes(query.toLowerCase())), [files, query]);
  const paths = useMemo(() => filtered.map((file) => file.path), [filtered]);
  const { model } = useFileTree({
    paths, initialExpansion: 'open', itemHeight: 24,
    onSelectionChange: (selected) => {
      if (selected.length === 1 && files.some((file) => file.path === selected[0])) onSelectFile(selected[0]);
    },
  });
  useEffect(() => {
    model.resetPaths(paths);
    model.setGitStatus(filtered.map(({ path, status }) => ({ path, status })));
  }, [model, paths, filtered]);
  useEffect(() => {
    if (activeFile && paths.includes(activeFile)) model.getItem(activeFile)?.select();
  }, [model, activeFile, paths]);
  return <aside className="file-sidebar flex shrink-0 flex-col min-h-0" style={{ width }}>
    <div className="sidebar-heading">Files changed <span>{files.length}</span></div>
    <div className="review-controls p-3">
      <input aria-label="Filter files" placeholder="Filter files…" value={query}
        onChange={(event) => setQuery(event.target.value)} className="w-full" />
      <span className="mt-2 block text-xs">{filtered.length} matches</span>
    </div>
    <FileTree model={model} className="min-h-0 flex-1 overflow-auto" style={{
      '--trees-bg-override': 'var(--color-deep-bg)', '--trees-fg-override': 'var(--color-text-secondary)',
      '--trees-border-color-override': 'var(--color-border-default)', '--trees-density-override': 0.8, '--trees-padding-inline-override': 8,
    } as React.CSSProperties} />
    <div className="sidebar-footer">CodeChat · Powered by Pierre</div>
  </aside>;
}

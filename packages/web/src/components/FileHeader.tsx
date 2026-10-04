import { Button } from './Button';
import type { FileSummary } from '../types';

export function FileHeader({ file, commentCount, isCollapsed, onToggle }: {
  file: FileSummary; commentCount: number; isCollapsed: boolean; isActive?: boolean; onToggle: () => void;
}) {
  return <div className="file-heading review-controls">
    <Button variant="outline" size="xs" aria-label={isCollapsed ? 'Expand file' : 'Collapse file'} aria-expanded={!isCollapsed} onClick={onToggle}>{isCollapsed ? '▸' : '▾'}</Button>
    <span className="font-mono min-w-0 flex-1 truncate">{file.status === 'renamed' && file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path}</span>
    <span>{file.status}</span><span className="added">+{file.additions}</span><span className="deleted">−{file.deletions}</span>
    {commentCount > 0 && <span>{commentCount} comments</span>}
  </div>;
}

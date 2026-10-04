import { parseDiff } from 'react-diff-view';

export const PAGE_ROWS = 200;
export const PAGE_CHARACTERS = 64 * 1024;
const MAX_LINE_CHARACTERS = 8 * 1024;
type File = ReturnType<typeof parseDiff>[number];
type Hunk = File['hunks'][number];

export interface DiffPage {
  file: File;
  page: number;
  pageCount: number;
  totalRows: number;
  omittedLines: number;
}

/** Runs in a worker. Preserve change line numbers/keys when splitting even a single huge hunk. */
export function paginateDiff(rawDiff: string): DiffPage[] {
  const file = parseDiff(rawDiff)[0];
  if (!file) throw new Error('Cannot parse this file diff');
  const pages: { hunks: Hunk[]; rows: number; chars: number; omitted: number }[] = [];
  let current = { hunks: [] as Hunk[], rows: 0, chars: 0, omitted: 0 };
  let totalRows = 0;
  const flush = () => {
    if (current.rows) pages.push(current);
    current = { hunks: [], rows: 0, chars: 0, omitted: 0 };
  };
  for (const hunk of file.hunks) {
    let oldStart = hunk.oldStart;
    let newStart = hunk.newStart;
    let part: Hunk | null = null;
    for (const original of hunk.changes) {
      const omitted = original.content.length > MAX_LINE_CHARACTERS;
      const change = omitted ? { ...original, content: '[Very long line omitted from preview; download the complete raw diff.]' } : original;
      if (current.rows >= PAGE_ROWS || current.chars + change.content.length > PAGE_CHARACTERS) {
        flush(); part = null;
      }
      if (!part) {
        part = { ...hunk, oldStart, newStart, oldLines: 0, newLines: 0, changes: [], content: '' };
        current.hunks.push(part);
      }
      part.changes.push(change);
      if (change.type !== 'insert') { part.oldLines++; oldStart++; }
      if (change.type !== 'delete') { part.newLines++; newStart++; }
      part.content = `@@ -${part.oldStart},${part.oldLines} +${part.newStart},${part.newLines} @@`;
      current.rows++; totalRows++; current.chars += change.content.length;
      if (omitted) current.omitted++;
    }
  }
  flush();
  if (!pages.length) pages.push(current);
  return pages.map((page, i) => ({
    file: { ...file, hunks: page.hunks }, page: i, pageCount: pages.length, totalRows, omittedLines: page.omitted,
  }));
}

export function pageForLine(pages: DiffPage[], side: 'old' | 'new', line: number): number {
  return pages.findIndex((page) => page.file.hunks.some((hunk) => hunk.changes.some((change) =>
    change.type === 'normal' ? (side === 'old' ? change.oldLineNumber : change.newLineNumber) === line
      : (side === 'old' ? change.type === 'delete' : change.type === 'insert') && change.lineNumber === line,
  )));
}

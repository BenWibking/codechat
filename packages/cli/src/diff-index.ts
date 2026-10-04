import type { FileSummary } from './types.js';

/** Index offsets, not copies or parsed line objects, for on-demand file loading. */
export function indexDiff(diff: string, files: FileSummary[]): Map<string, { start: number; end: number }> {
  const starts = Array.from(diff.matchAll(/^diff --git /gm), (match) => match.index!);
  if (starts.length !== files.length) throw new Error('Diff file index does not match file summaries');
  return new Map(files.map((file, i) => [file.path, {
    start: starts[i], end: starts[i + 1] ?? diff.length,
  }]));
}

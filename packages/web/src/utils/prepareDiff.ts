import { parseDiff } from 'react-diff-view';

const MAX_LINE_CHARACTERS = 8 * 1024;
type File = ReturnType<typeof parseDiff>[number];

export interface PreparedDiff {
  file: File;
  omittedLines: number;
}

/** Runs in a worker. Replaces very long lines with placeholders while preserving line numbers/keys. */
export function prepareDiff(rawDiff: string): PreparedDiff {
  const file = parseDiff(rawDiff)[0];
  if (!file) throw new Error('Cannot parse this file diff');
  let omittedLines = 0;
  const hunks = file.hunks.map((hunk) => ({
    ...hunk,
    changes: hunk.changes.map((change) => {
      if (change.content.length <= MAX_LINE_CHARACTERS) return change;
      omittedLines++;
      return { ...change, content: '[Very long line omitted from preview; download the complete raw diff.]' };
    }),
  }));
  return { file: { ...file, hunks }, omittedLines };
}

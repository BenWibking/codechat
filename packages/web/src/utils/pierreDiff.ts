import { parsePatchFiles } from '@pierre/diffs';
import type { DiffPage } from './diffPages';

/** Adapt a bounded worker page without changing its original old/new anchors. */
export function toPierreDiff(file: DiffPage['file'], path: string) {
  const oldName = file.type === 'add' ? '/dev/null' : `a/${file.oldPath || path}`;
  const newName = file.type === 'delete' ? '/dev/null' : `b/${file.newPath || path}`;
  const patch = `diff --git ${JSON.stringify(`a/${file.oldPath || path}`)} ${JSON.stringify(`b/${file.newPath || path}`)}\n` +
    `--- ${JSON.stringify(oldName)}\n+++ ${JSON.stringify(newName)}\n` +
    file.hunks.map((hunk) => `${hunk.content}\n` + hunk.changes.map((change) =>
      `${change.type === 'insert' ? '+' : change.type === 'delete' ? '-' : ' '}${change.content}\n`).join('')).join('');
  const diff = parsePatchFiles(patch)[0]?.files[0];
  if (!diff) throw new Error('Could not prepare the diff display');
  return diff;
}

export function hasLine(file: DiffPage['file'], side: 'old' | 'new', line: number) {
  return file.hunks.some((hunk) => hunk.changes.some((change) => change.type === 'normal'
    ? (side === 'old' ? change.oldLineNumber : change.newLineNumber) === line
    : (side === 'old' ? change.type === 'delete' : change.type === 'insert') && change.lineNumber === line));
}

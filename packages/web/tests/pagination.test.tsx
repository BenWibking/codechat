import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDiff } from 'react-diff-view';
import { paginateDiff, pageForLine, PAGE_ROWS, PAGE_CHARACTERS } from '../src/utils/diffPages';

export function addedDiff(path: string, count: number, width = 50): string {
  return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${count} @@\n` +
    Array.from({ length: count }, (_, i) => `+line ${i + 1} ${'x'.repeat(width)}\n`).join('');
}

test('a 33,502-line single hunk is fully accessible with bounded pages and original line numbers', () => {
  const raw = addedDiff('inventory.json', 33502);
  const pages = paginateDiff(raw);
  const changes = pages.flatMap((page) => page.file.hunks.flatMap((hunk) => hunk.changes));
  assert.deepEqual(changes, parseDiff(raw)[0].hunks[0].changes);
  assert.equal(pages.length, 168);
  assert.equal(pageForLine(pages, 'new', 33502), 167);
  for (const page of pages) {
    const rows = page.file.hunks.flatMap((hunk) => hunk.changes);
    assert.ok(rows.length <= PAGE_ROWS);
    assert.ok(rows.reduce((sum, row) => sum + row.content.length, 0) <= PAGE_CHARACTERS);
  }
});

test('multi-hunk modifications, deletion and rename preserve all old/new comment anchors', () => {
  const raw = 'diff --git a/old.txt b/new.txt\nsimilarity index 90%\nrename from old.txt\nrename to new.txt\n--- a/old.txt\n+++ b/new.txt\n@@ -10,250 +10,250 @@\n' +
    Array.from({ length: 250 }, (_, i) => `-old ${i}\n`).join('') +
    Array.from({ length: 250 }, (_, i) => `+new ${i}\n`).join('') +
    '@@ -400,2 +400,1 @@\n context\n-deleted\n';
  const pages = paginateDiff(raw);
  assert.deepEqual(pages.flatMap((p) => p.file.hunks.flatMap((h) => h.changes)), parseDiff(raw)[0].hunks.flatMap((h) => h.changes));
  assert.equal(pageForLine(pages, 'old', 401), 2);
  assert.equal(pageForLine(pages, 'new', 259), 2);
  assert.equal(pageForLine(pages, 'old', 999), -1);
});

test('byte-heavy lines split pages; pathological lines get explicit placeholders without losing anchors', () => {
  const pages = paginateDiff(addedDiff('wide.json', 100, 7000));
  assert.ok(pages.length > 10);
  assert.equal(pages.reduce((sum, p) => sum + p.omittedLines, 0), 0);
  const giant = paginateDiff(addedDiff('giant.txt', 1, 20 * 1024 * 1024))[0];
  assert.equal(giant.omittedLines, 1);
  assert.ok(JSON.stringify(giant).length < 2000);
  assert.equal(pageForLine([giant], 'new', 1), 0);
});

test('binary and empty added files remain visible', () => {
  const page = paginateDiff('diff --git a/blob b/blob\nnew file mode 100644\nBinary files /dev/null and b/blob differ\n')[0];
  assert.equal(page.file.hunks.length, 0);
  assert.equal(page.pageCount, 1);
});

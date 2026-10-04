import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import { paginateDiff } from '../src/utils/diffPages';

const path = process.argv[2];
if (!path) throw new Error('Usage: pnpm benchmark <saved-session.json> [--baseline]');
const { diff, files } = JSON.parse(readFileSync(path, 'utf8'));
const start = performance.now();
if (process.argv.includes('--baseline')) {
  // Reproduce the original eager rendering workload (even without syntax highlighting).
  const parsed = parseDiff(diff, { nearbySequences: 'zip' });
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, parsed.map((file) =>
    React.createElement(Diff, { key: file.newPath, viewType: 'unified', diffType: file.type, hunks: file.hunks },
      (hunks) => hunks.map((hunk, i) => React.createElement(Hunk, { key: i, hunk })),
    ),
  )));
  console.log(JSON.stringify({ mode: 'baseline', milliseconds: performance.now() - start, htmlBytes: Buffer.byteLength(html), rss: process.memoryUsage().rss }));
} else {
  const starts = Array.from(diff.matchAll(/^diff --git /gm), (match: RegExpMatchArray) => match.index!);
  let pages = 0, rows = 0, maxRows = 0, maxPayloadBytes = 0;
  for (let i = 0; i < starts.length; i++) {
    for (const page of paginateDiff(diff.slice(starts[i], starts[i + 1] ?? diff.length))) {
      const count = page.file.hunks.reduce((sum, hunk) => sum + hunk.changes.length, 0);
      pages++; rows += count; maxRows = Math.max(maxRows, count);
      maxPayloadBytes = Math.max(maxPayloadBytes, Buffer.byteLength(JSON.stringify(page)));
    }
  }
  console.log(JSON.stringify({ mode: 'paged', files: files.length, diffBytes: Buffer.byteLength(diff), milliseconds: performance.now() - start, pages, rows, maxRows, maxPayloadBytes, rss: process.memoryUsage().rss }));
}

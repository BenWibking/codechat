import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { WebSocket } from 'ws';
import { startReviewServer } from '../src/server';
import { getDiff, parseFileSummaries } from '../src/git';
import { indexDiff } from '../src/diff-index';
import type { Session } from '../src/types';

function message(ws: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('No server message')), 5000);
    ws.once('message', (data) => { clearTimeout(timeout); resolve(JSON.parse(data.toString())); });
  });
}

async function fixture(diff: string) {
  const dir = await mkdtemp(join(tmpdir(), 'codechat-server-'));
  process.env.XDG_DATA_HOME = join(dir, 'data');
  const repoPath = join(dir, 'repo');
  await mkdir(repoPath); execFileSync('git', ['init', '-q'], { cwd: repoPath });
  const webDistPath = join(dir, 'web');
  await mkdir(webDistPath); await writeFile(join(webDistPath, 'index.html'), 'test');
  const session: Session = { id: 'test', repoPath, createdAt: '', updatedAt: '', status: 'pending', diff, files: parseFileSummaries(diff), comments: [] };
  const server = await startReviewServer({ session, webDistPath, timeout: 15000 });
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
  const init = await message(ws);
  return { session, server, ws, init, dir };
}

function addedDiff(path: string, lines: number, width = 80) {
  return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines} @@\n` + `+${'x'.repeat(width)}\n`.repeat(lines);
}

test('20 MB / 1,073 files: metadata-only init, exact lazy downloads, persisted inline comment', async () => {
  const diff = Array.from({ length: 1073 }, (_, i) => addedDiff(`file-${i}.txt`, 200, 96)).join('');
  const { session, server, ws, init, dir } = await fixture(diff);
  assert.ok(Buffer.byteLength(diff) > 20 * 1024 * 1024);
  assert.equal(init.data.diff, undefined);
  assert.equal(init.data.files.length, 1073);
  assert.ok(JSON.stringify(init).length < 200000);
  const entry = indexDiff(diff, session.files).get('file-1072.txt')!;
  const url = `http://127.0.0.1:${server.port}/api/file-diff?path=file-1072.txt&revision=${init.data.revision}`;
  assert.equal(await (await fetch(url)).text(), diff.slice(entry.start, entry.end));
  assert.equal((await fetch(url.replace(init.data.revision, 'stale'))).status, 409);
  assert.equal((await fetch(url.replace('file-1072.txt', '../secret'))).status, 404);
  const comment = message(ws);
  ws.send(JSON.stringify({ type: 'add_comment', data: { filePath: 'file-1072.txt', line: 199, endLine: 200, side: 'new', body: 'Last page range' } }));
  assert.equal((await comment).data.endLine, 200);
  ws.send(JSON.stringify({ type: 'submit_review' }));
  const result = await server.result;
  assert.equal(result.status, 'changes_requested');
  assert.equal(result.comments[0].line, 199);
  const sessions = join(dir, 'data/codechat/sessions');
  const { readdir } = await import('node:fs/promises');
  assert.equal(JSON.parse(await readFile(join(sessions, (await readdir(sessions))[0]), 'utf8')).comments[0].body, 'Last page range');
});

test('a lost browser connection ends pending rather than approving unseen changes', async () => {
  const { server, ws } = await fixture(addedDiff('one.txt', 1));
  ws.close();
  assert.equal((await server.result).status, 'pending');
});

test('live updates invalidate stale file requests and send only metadata', async () => {
  const { server, session, ws, init } = await fixture(addedDiff('one.txt', 1));
  const updated = message(ws);
  await writeFile(join(session.repoPath, 'new.txt'), 'actual working tree\n');
  const update = await updated;
  assert.equal(update.type, 'diff_updated');
  assert.equal(update.data.diff, undefined);
  assert.notEqual(update.data.revision, init.data.revision);
  assert.equal((await fetch(`http://127.0.0.1:${server.port}/api/file-diff?path=new.txt&revision=${init.data.revision}`)).status, 409);
  ws.send(JSON.stringify({ type: 'submit_review' }));
  assert.equal((await server.result).status, 'approved');
});

test('tracked diffs larger than the former 10 MB limit and binary untracked files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codechat-git-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  await writeFile(join(dir, 'big.txt'), 'old\n');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'fixture'], { cwd: dir });
  await writeFile(join(dir, 'big.txt'), `${'a'.repeat(100)}\n`.repeat(120000));
  await writeFile(join(dir, 'binary'), Buffer.from([0, 1, 2, 3]));
  const diff = await getDiff(dir);
  assert.ok(Buffer.byteLength(diff) > 10 * 1024 * 1024);
  assert.match(diff, /Binary files \/dev\/null and b\/binary differ/);
  assert.equal(parseFileSummaries(diff).length, 2);
});

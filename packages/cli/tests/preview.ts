// Replay a saved session with the current UI without modifying the source repository/session.
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { startReviewServer } from '../src/server';
import type { Session } from '../src/types';

if (!process.argv[2]) throw new Error('Usage: tsx packages/cli/tests/preview.ts <session.json>');
const session: Session = JSON.parse(await readFile(process.argv[2], 'utf8'));
session.repoPath = await mkdtemp(join(tmpdir(), 'codechat-preview-'));
session.id = 'large-diff-preview';
execFileSync('git', ['init', '-q'], { cwd: session.repoPath });
process.env.XDG_DATA_HOME = await mkdtemp(join(tmpdir(), 'codechat-preview-data-'));
const server = await startReviewServer({
  session, webDistPath: fileURLToPath(new URL('../../web/dist', import.meta.url)),
});
console.log(server.url);
console.log(await server.result);

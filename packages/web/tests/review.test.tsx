import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import { startReviewServer } from '../../cli/src/server';
import { parseFileSummaries } from '../../cli/src/git';
import type { Session } from '../../cli/src/types';

// Pierre virtualizes into shadow DOM. Exercise the actual browser rather than mocking its renderer.
test('Pierre review preserves final-page ranges, old/new sides, replies, edits, navigation and submission', { timeout: 60000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'codechat-pierre-test-'));
  process.env.XDG_DATA_HOME = join(dir, 'data');
  const repoPath = join(dir, 'repo');
  await mkdir(repoPath);
  execFileSync('git', ['init', '-q'], { cwd: repoPath });
  const contents = Array.from({ length: 33502 }, (_, i) => `line ${i + 1}\n`).join('');
  await writeFile(join(repoPath, 'large.txt'), contents);
  const added = `diff --git a/large.txt b/large.txt\nnew file mode 100644\n--- /dev/null\n+++ b/large.txt\n@@ -0,0 +1,33502 @@\n` + contents.split('\n').slice(0, -1).map((line) => `+${line}\n`).join('');
  const changed = 'diff --git a/src/value.ts b/src/value.ts\n--- a/src/value.ts\n+++ b/src/value.ts\n@@ -10,2 +10,2 @@\n-export const value = 1;\n+export const value = 2;\n context\n';
  const extra = Array.from({ length: 1071 }, (_, i) => `diff --git a/extra-${i}.txt b/extra-${i}.txt\nnew file mode 100644\n--- /dev/null\n+++ b/extra-${i}.txt\n`).join('');
  const session: Session = { id: 'pierre-test', repoPath, createdAt: '', updatedAt: '', status: 'pending', diff: added + changed + extra,
    files: parseFileSummaries(added + changed + extra), comments: [{ id: 'reply', filePath: 'src/value.ts', line: 10, side: 'new', body: 'Please explain', resolved: true, agentReply: 'Updated the value.', createdAt: '' }] };
  const server = await startReviewServer({ session, webDistPath: resolve('packages/web/dist'), timeout: 60000 });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`http://127.0.0.1:${server.port}`);
    await expect(page.locator('diffs-container')).toHaveCount(1);
    await expect(page.getByText('line 1', { exact: true })).toBeVisible();
    assert.ok(await page.getByRole('treeitem').count() < 100, 'File tree should virtualize 1,073 paths');
    await page.getByLabel('Diff page').fill('168');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(page.getByText('line 33401', { exact: true })).toBeVisible();
    await page.locator('.pierre-code-view').evaluate((element) => element.scrollTop = element.scrollHeight);
    await expect(page.getByText('line 33502', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await expect(page.locator('[data-diff-type="split"]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Unified', exact: true }).click();
    await page.locator('.pierre-code-view').evaluate((element) => element.scrollTop = element.scrollHeight);
    // Comment on the final page through the real gutter.
    const gutter = page.locator('[data-column-number]');
    const first = gutter.filter({ hasText: /^33501$/ }).last();
    const last = gutter.filter({ hasText: /^33502$/ }).last();
    await first.dragTo(last);
    await expect(page.getByPlaceholder('Leave a comment')).toBeVisible();
    await page.getByPlaceholder('Leave a comment').fill('Exact final line');
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(page.getByText('Exact final line', { exact: true })).toBeVisible();
    assert.equal(session.comments.at(-1)?.line, 33501);
    assert.equal(session.comments.at(-1)?.side, 'new');
    assert.equal(session.comments.at(-1)?.endLine, 33502);
    await page.locator('.pierre-code-view').evaluate((element) => element.scrollTop = element.scrollHeight);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Edit comment').fill('Edited final line');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Edited final line', { exact: true })).toBeVisible();
    await page.getByLabel('Filter files').fill('value');
    await page.getByRole('treeitem', { name: 'value.ts', exact: true }).click();
    await expect(page.getByText('Updated the value.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Split', exact: true }).click();
    await page.locator('[data-line-type="change-deletion"][data-column-number="10"]').click();
    await page.getByPlaceholder('Leave a comment').fill('Old side');
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(page.getByText('Old side', { exact: true })).toBeVisible();
    assert.equal(session.comments.at(-1)?.side, 'old');
    const oldId = session.comments.at(-1)!.id;
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Old side', { exact: true })).toHaveCount(0);
    assert.ok(!session.comments.some((comment) => comment.id === oldId));
    await page.getByRole('button', { name: /Switch to dark mode/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
    await expect.poll(() => page.locator('diffs-container').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('dark');
    await page.screenshot({ path: join(dir, 'review.png') });
    await page.getByRole('button', { name: 'Reply', exact: true }).click();
    await page.getByPlaceholder('Leave a comment').fill('Thanks for explaining');
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    await expect(page.getByText('Thanks for explaining', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Submit review/ }).click();
    await page.getByPlaceholder('General comment (optional)').fill('Review summary');
    await page.getByRole('button', { name: 'Submit review', exact: true }).click();
    const result = await server.result;
    assert.equal(result.status, 'changes_requested');
    assert.equal(result.summary, 'Review summary');
    assert.deepEqual(errors, []);
  } catch (error) {
    await page.screenshot({ path: join(dir, "failure.png") });
    console.error("Browser artifacts:", dir, "Errors:", errors);
    throw error;
  } finally {
    await browser.close();

  }
});

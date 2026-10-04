import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginateDiff } from '../src/utils/diffPages';
import { toPierreDiff, hasLine } from '../src/utils/pierreDiff';

test('Pierre adapter preserves final-page anchors, rename paths and deletion sides', () => {
  const raw = 'diff --git a/old name.ts b/new name.ts\nrename from old name.ts\nrename to new name.ts\n--- a/old name.ts\n+++ b/new name.ts\n@@ -400,2 +900,2 @@\n-old\n+new\n context\n';
  const page = paginateDiff(raw)[0];
  const diff = toPierreDiff(page.file, 'new name.ts');
  assert.equal(diff.name, 'new name.ts');
  assert.equal(diff.hunks[0].deletionStart, 400);
  assert.equal(diff.hunks[0].additionStart, 900);
  assert.equal(hasLine(page.file, 'old', 400), true);
  assert.equal(hasLine(page.file, 'new', 900), true);
  assert.equal(hasLine(page.file, 'old', 900), false);
  const added = 'diff --git a/x b/x\n--- /dev/null\n+++ b/x\n@@ -0,0 +1,401 @@\n' + '+line\n'.repeat(401);
  const last = paginateDiff(added).at(-1)!;
  assert.equal(toPierreDiff(last.file, 'x').hunks[0].additionStart, 401);
});

test('empty and binary pages can be passed to Pierre', () => {
  const page = paginateDiff('diff --git a/blob b/blob\nnew file mode 100644\nBinary files /dev/null and b/blob differ\n')[0];
  assert.equal(toPierreDiff(page.file, 'blob').hunks.length, 0);
});

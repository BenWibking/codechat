# Large diff handling and validation

The failure case was a saved review containing 1,073 files, 18,908,820 bytes of
patch text and 310,532 changed lines. One added JSON file had a single hunk with
33,502 lines. The previous UI parsed and rendered every file at once, using the
parser's sequence-zipping option and unrestricted syntax highlighting.

## Implementation

The server indexes file boundaries and sends file metadata over WebSocket.
`/api/file-diff` returns the selected file's exact patch, guarded by a session
revision. A stale revision receives HTTP 409. A dedicated worker fetches and
parses that patch; changing files terminates the worker and cancels obsolete
work. Only the selected page crosses back to the main thread.

Pages contain at most 200 changes and 65,536 content characters, excluding a
single oversized line. Lines exceeding 8,192 characters get an explicit
placeholder with their original line coordinates. A download link preserves
access to the complete original patch. Page splitting preserves old and new
line numbers for selection and comments, including modifications and renames.
The file list renders at most 100 entries at a time; filtering searches all
paths. Highlighting is limited to small pages. Context expansion is limited to
small files, 20 lines per operation, and 200 total displayed lines; unavailable
or oversized source content produces an explicit error.

Git command buffers now allow 128 MiB, exceeding the former 10 MiB limit.
Untracked files are read in batches of eight, and NUL-containing files are
identified as binary. Browser disconnection or timeout saves a pending review;
it does not imply approval.

## Reproduce

From the checkout, using Node 20.6 or newer and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm benchmark /path/to/saved-session.json
NODE_OPTIONS=--max-old-space-size=512 pnpm benchmark /path/to/saved-session.json --baseline
node --import tsx packages/cli/tests/preview.ts /path/to/saved-session.json
```

The preview prints a URL to open in Chrome. It copies the session into temporary
storage and uses an empty temporary repository, preserving the original review
and checkout. Context expansion therefore has no original working-tree source
in this replay.

Nine regression tests cover metadata-only transfer of a 20 MB/1,073-file
session, exact lazy downloads, stale revisions, persisted comments, pending
disconnects, live updates, >10 MB tracked patches, untracked binary detection,
bounded multi-hunk pagination, pathological lines, filtering, view switching,
and commenting at the last source line in the React application.

On the original capture, the standalone paged benchmark processed all 1,073
files and 310,532 rows into 2,207 pages in approximately 187 ms, with a maximum
of 200 rows per page and approximately 176 MB process RSS. Its largest serialized
page was 178,409 bytes, including parser metadata. The eager baseline exceeded
a 512 MB JavaScript heap and aborted even without highlighting. These are local
Node measurements, not browser heap measurements or a universal size limit.

A separate Chrome window successfully opened the original session, filtered
its file list, and loaded the 33,502-line inventory file without hanging. The
browser check also exposed immediate navigation while typing a page number;
navigation now happens only on Enter or Go, covered by the React regression.
Both package builds and TypeScript checks passed, as did all nine tests.

## Remaining bounds

The server still retains the complete patch and persists it in the session JSON.
The worker parses the entire selected file, so its memory use grows with that
file's size. This change bounds main-thread transfer and rendering rather than
providing unlimited patch ingestion. Larger-than-128-MiB Git command output
still fails explicitly. Server and web assets must be built together because
the WebSocket protocol now carries metadata and revisions instead of patches;
saved session JSON remains compatible.

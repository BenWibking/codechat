import { paginateDiff, pageForLine, type DiffPage } from './utils/diffPages';

let pages: DiffPage[] = [];
const worker = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage: (data: unknown) => void };
worker.onmessage = async (event) => {
  try {
    if (event.data.type === 'load') {
      const response = await fetch(event.data.url);
      if (!response.ok) throw new Error(await response.text());
      worker.postMessage({ type: 'loading', message: 'Preparing file…' });
      pages = paginateDiff(await response.text());
    }
    let index = event.data.page ?? 0;
    if (event.data.line !== undefined) {
      index = pageForLine(pages, event.data.side, event.data.line);
      if (index < 0) throw new Error('This comment line is no longer present in the diff.');
    }
    worker.postMessage({ type: 'page', data: pages[Math.max(0, Math.min(pages.length - 1, index))] });
  } catch (error) {
    worker.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

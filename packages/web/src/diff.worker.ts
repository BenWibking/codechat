import { prepareDiff } from './utils/prepareDiff';

const worker = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage: (data: unknown) => void };
worker.onmessage = async (event) => {
  try {
    const response = await fetch(event.data.url);
    if (!response.ok) throw new Error(await response.text());
    worker.postMessage({ type: 'loading', message: 'Preparing file…' });
    worker.postMessage({ type: 'diff', data: prepareDiff(await response.text()) });
  } catch (error) {
    worker.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

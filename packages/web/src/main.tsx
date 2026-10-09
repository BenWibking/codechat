import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkerPoolContextProvider } from '@pierre/diffs/react';
import HighlightWorker from '@pierre/diffs/worker/worker.js?worker';
import App from './App';
import './app.css';

// Highlighting off the main thread also lets Pierre build only the visible
// window of very large diffs instead of the whole file on every scroll.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkerPoolContextProvider
      poolOptions={{ workerFactory: () => new HighlightWorker(), poolSize: 2 }}
      highlighterOptions={{ theme: { light: 'pierre-light', dark: 'pierre-dark' } }}>
      <App />
    </WorkerPoolContextProvider>
  </StrictMode>,
);

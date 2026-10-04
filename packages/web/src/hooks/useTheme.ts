import { useSyncExternalStore, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';
type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'codechat-theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme(): Theme {
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

function getStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

function applyTheme(preference: ThemePreference): void {
  const html = document.documentElement;
  if (preference === 'system') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', preference);
  }
}

function getTheme(): Theme {
  const preference = getStoredPreference();
  return preference === 'system' ? getSystemTheme() : preference;
}

function subscribe(listener: () => void) {
  const media = window.matchMedia(MEDIA_QUERY);
  window.addEventListener('codechat-theme-change', listener);
  window.addEventListener('storage', listener);
  media.addEventListener('change', listener);
  return () => {
    window.removeEventListener('codechat-theme-change', listener);
    window.removeEventListener('storage', listener);
    media.removeEventListener('change', listener);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme);
  useEffect(() => applyTheme(getStoredPreference()), [theme]);
  const toggleTheme = useCallback(() => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event('codechat-theme-change'));
  }, []);
  return { theme, toggleTheme };
}

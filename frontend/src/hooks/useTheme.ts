import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
const KEY = 'kiro-theme';

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

// Theme: light/dark/system, persisted in localStorage. System uses prefers-color-scheme.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'system');

  useEffect(() => { apply(theme); localStorage.setItem(KEY, theme); }, [theme]);

  // Cycle system -> light -> dark -> system
  const cycle = useCallback(() => {
    setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'));
  }, []);

  return { theme, setTheme, cycle };
}

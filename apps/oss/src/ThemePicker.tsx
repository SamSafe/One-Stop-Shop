import { useEffect, useState } from 'react';
type Theme = 'system' | 'light' | 'dark';
const key = 'oss-appearance-v1';
function readTheme(): Theme {
  try {
    const value = localStorage.getItem(key);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}
export function applyAppearance(theme: Theme = readTheme()) {
  document.documentElement.dataset.theme =
    theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
}
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => applyAppearance(theme);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setTheme(readTheme());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return (
    <label className="theme-picker">
      <span className="sr-only">Appearance</span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Z" />
        <path d="M12 3v18" />
      </svg>
      <select
        aria-label="Appearance"
        value={theme}
        onChange={(event) => {
          const next = event.target.value as Theme;
          setTheme(next);
          try {
            localStorage.setItem(key, next);
          } catch {
            /* Appearance remains available for this visit. */
          }
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

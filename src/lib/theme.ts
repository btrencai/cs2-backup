export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "cs2-backup.theme";

export function getStoredTheme(): ThemeMode | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function getSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveInitialTheme(): ThemeMode {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

export function persistTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, persistTheme, resolveInitialTheme, type ThemeMode } from "../lib/theme";

const SUN_PATH =
  "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z";

const MOON_PATH =
  "M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (getStoredTheme()) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (event: MediaQueryListEvent) => {
      if (getStoredTheme()) return;
      setTheme(event.matches ? "light" : "dark");
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  };

  const label = theme === "dark" ? "切换到浅色主题" : "切换到深色主题";

  return (
    <button className="theme-toggle" type="button" aria-label={label} title={label} onClick={toggle}>
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d={theme === "dark" ? SUN_PATH : MOON_PATH} />
      </svg>
    </button>
  );
}

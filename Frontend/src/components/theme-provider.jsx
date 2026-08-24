import { createContext, useContext, useEffect, useState } from "react";
const STORAGE_KEY = "drivealert-theme";
const ThemeContext = createContext(null);
function getStoredTheme() {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* localStorage unavailable (private mode, disabled storage) */
  }
  return "dark";
}
function resolveTheme(theme) {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function applyTheme(resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(theme));
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage unavailable */
    }
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      const next = media.matches ? "light" : "dark";
      setResolvedTheme(next);
      applyTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
  function setTheme(next) {
    setThemeState(next);
  }
  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

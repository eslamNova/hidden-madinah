"use client";

import { useCallback, useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/constants";

function readTheme(): Theme {
  // Dark is the default (see the pre-paint script in layout.tsx).
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Current theme as reflected on <html data-theme>, kept in sync across every
 * consumer via a MutationObserver (the toggle writes the attribute; maps and
 * others just watch it). The pre-paint script in layout.tsx sets the initial
 * value from storage / prefers-color-scheme before hydration.
 */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  useEffect(() => {
    setThemeState(readTheme());
    const observer = new MutationObserver(() => setThemeState(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the attribute still applies for this visit.
    }
  }, []);

  return [theme, setTheme];
}

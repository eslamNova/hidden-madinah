"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/use-theme";

/** 48px light/dark switch — lives beside the أ−/أ+ stepper in the floating pill. */
export function ThemeToggle() {
  const t = useTranslations("theme");
  const [theme, setTheme] = useTheme();
  // The icons are CSS-driven (correct from the first frame); only the label is
  // JS-driven, so it assumes the default theme until mount — that keeps SSR and
  // the hydration render identical for visitors who opted into light.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted ? theme === "dark" : true;

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={dark ? t("switchToLight") : t("switchToDark")}
      className="press flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-ink/30 bg-surface text-ink"
    >
      {/* Both rendered; globals.css hides the wrong one off data-theme, which
          is already correct pre-hydration (no first-paint icon flash). */}
      <Sun aria-hidden="true" className="theme-dark-only h-6 w-6" />
      <Moon aria-hidden="true" className="theme-light-only h-6 w-6" />
    </button>
  );
}

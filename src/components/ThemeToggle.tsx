"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/use-theme";

/** 48px light/dark switch — lives beside the أ−/أ+ stepper in the floating pill. */
export function ThemeToggle() {
  const t = useTranslations("theme");
  const [theme, setTheme] = useTheme();
  // SSR renders "light"; read the real theme only after mount so hydration
  // matches (the pill is collapsed at load, so the icon swap is unseen).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? t("switchToLight") : t("switchToDark")}
      className="press flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-ink/30 bg-surface text-ink"
    >
      {dark ? (
        <Sun aria-hidden="true" className="h-6 w-6" />
      ) : (
        <Moon aria-hidden="true" className="h-6 w-6" />
      )}
    </button>
  );
}

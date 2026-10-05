"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { TextSizeControl } from "@/components/TextSizeControl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { useBarePath } from "@/lib/use-lang";

/**
 * The أ−/أ+ font stepper as a floating corner control — the top navbar is
 * gone, but text sizing is an elderly-first accessibility feature that must
 * stay one tap away on every page.
 *
 * Collapsed: a single 48px round "أ" button, fixed at the inline-start corner
 * (physical top-RIGHT in RTL — the free corner on every public page; the
 * map's physical left holds its legend and zoom controls). Expanded: a pill
 * containing the unchanged TextSizeControl (it keeps its role=group and
 * aria-live announcer). Dark glass over the story landing, light surface
 * everywhere else — near-opaque, never backdrop-blur.
 */
export function FloatingTextSize() {
  const t = useTranslations("fontSize");
  const pathname = useBarePath();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    // Capture phase: scroll events don't bubble, and the landing scrolls
    // inside its own snap container rather than the document.
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);

  // The admin area has its own top chrome — a floating button would overlap
  // it — and the tour is a chrome-less media stream with its own exit button.
  if (pathname.startsWith("/admin") || pathname.endsWith("/tour")) return null;

  const onStory = pathname === "/";
  const shell = onStory
    ? "border-paper/15 bg-basalt/85 text-paper"
    : "border-ink/10 bg-surface/95 text-ink";

  return (
    <div
      ref={rootRef}
      className="fixed start-2 top-[max(env(safe-area-inset-top),0.5rem)] z-40 flex items-center gap-2"
    >
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("controlsLabel")}
        aria-expanded={open}
        aria-controls={panelId}
        className={`press flex h-12 items-center gap-1.5 rounded-full border px-3.5 shadow-lg ${shell}`}
      >
        {/* Two symbols so the button reads as "text size + theme" at a glance.
            Both theme icons render; globals.css hides the wrong one off
            data-theme, so the pill is never wrong on the first paint. */}
        <span aria-hidden="true" className="text-xl font-bold leading-none">
          {t("glyph")}
        </span>
        <span aria-hidden="true" className="h-4 w-px bg-current/25" />
        <Sun aria-hidden="true" className="theme-dark-only h-5 w-5" />
        <Moon aria-hidden="true" className="theme-light-only h-5 w-5" />
      </button>
      {/* Before the panel: the closed panel keeps its (invisible) width. */}
      {!open && <LanguageSwitch className={shell} />}
      <div
        id={panelId}
        className={`rounded-full border p-1.5 shadow-lg transition-[opacity,transform] duration-200 ease-out ${shell} ${
          open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none opacity-0 ltr:-translate-x-2 rtl:translate-x-2"
        }`}
        // Keep the controls out of the tab order while visually hidden.
        {...(!open && { inert: true })}
      >
        <div className="flex items-center gap-2">
          <TextSizeControl />
          <span aria-hidden="true" className="h-8 w-px bg-current/20" />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

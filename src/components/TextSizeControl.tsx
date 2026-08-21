"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FONT_STEPS, FONT_STEP_STORAGE_KEY } from "@/lib/constants";

/**
 * 3-step text-size control (18 / 20 / 23px on <html>), persisted in
 * localStorage. The inline script in layout.tsx applies the saved step before
 * hydration, so here we only read the current DOM state.
 */
export function TextSizeControl() {
  const t = useTranslations("fontSize");
  const [step, setStep] = useState(0);

  useEffect(() => {
    const current = document.documentElement.dataset.fontStep;
    if (current === "1" || current === "2") setStep(Number(current));
  }, []);

  function apply(next: number) {
    const clamped = Math.min(FONT_STEPS.length - 1, Math.max(0, next));
    setStep(clamped);
    if (clamped === 0) {
      delete document.documentElement.dataset.fontStep;
    } else {
      document.documentElement.dataset.fontStep = String(clamped);
    }
    try {
      localStorage.setItem(FONT_STEP_STORAGE_KEY, String(clamped));
    } catch {
      // Private mode etc. — the control still works for this visit.
    }
  }

  const buttonClass =
    "flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-ink/30 bg-surface text-lg font-semibold text-ink disabled:opacity-40";

  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-2">
      <button
        type="button"
        className={buttonClass}
        onClick={() => apply(step - 1)}
        disabled={step === 0}
        aria-label={t("decrease")}
      >
        أ−
      </button>
      <button
        type="button"
        className={buttonClass}
        onClick={() => apply(step + 1)}
        disabled={step === FONT_STEPS.length - 1}
        aria-label={t("increase")}
      >
        أ+
      </button>
      <span aria-live="polite" className="sr-only">
        {t("announce", { size: FONT_STEPS[step] })}
      </span>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Cookie } from "lucide-react";

/**
 * The one-time cookie notice. GA4's first-party cookie is personal data under
 * PDPL, so the tag stays off until this is answered.
 *
 * Elderly-first and deliberately not a dark pattern: accept and decline are the
 * same size, same weight, same row, one tap each, neither pre-selected. It
 * floats ABOVE the bottom dock instead of covering it — a legal notice must
 * never take the navigation away — and the wrapper is pointer-events-none so
 * the dock underneath stays tappable while the notice is up.
 */
export function ConsentBanner({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations("consent");

  return (
    <div
      role="region"
      aria-labelledby="consent-title"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(max(env(safe-area-inset-bottom),0.75rem)+5rem)]"
    >
      <div className="sheet-in card-elevated pointer-events-auto mx-auto max-w-md p-5">
        <div className="flex items-start gap-3">
          <Cookie aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-brand" />
          <div className="min-w-0">
            <h2 id="consent-title" className="text-lg">
              {t("title")}
            </h2>
            <p className="mt-1 text-muted">{t("message")}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onAccept}
            className="press min-h-14 flex-1 rounded-2xl bg-primary px-6 text-lg font-semibold text-paper"
          >
            {t("accept")}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="press min-h-14 flex-1 rounded-2xl bg-ink/10 px-6 text-lg font-semibold text-ink"
          >
            {t("decline")}
          </button>
        </div>

        <Link
          href="/privacy"
          className="mt-3 inline-block text-sm text-brand underline underline-offset-4"
        >
          {t("learnMore")}
        </Link>
      </div>
    </div>
  );
}

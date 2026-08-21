"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-elevated flex flex-col items-center gap-6 p-8 text-center">
        <h1 className="text-3xl">{t("genericTitle")}</h1>
        <p className="text-lg text-muted">{t("genericMessage")}</p>
        <button
          type="button"
          onClick={reset}
          className="press flex min-h-14 items-center justify-center rounded-2xl bg-primary px-8 text-lg font-semibold text-surface"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
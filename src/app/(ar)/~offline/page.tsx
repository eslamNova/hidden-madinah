import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  const t = useTranslations("offline");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="card-elevated flex flex-col items-center gap-6 p-8 text-center">
        <WifiOff aria-hidden="true" className="h-16 w-16 text-muted" />
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="text-muted">{t("message")}</p>
        {/* Plain anchor on purpose: retry must be a full page load, not client-side nav. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="press flex min-h-14 items-center justify-center rounded-2xl bg-primary px-8 text-lg font-semibold text-paper"
        >
          {t("retry")}
        </a>
      </div>
    </div>
  );
}

import { createTranslator, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { WifiOff } from "lucide-react";
import enMessages from "../../../../messages/en.json";

/**
 * The service worker's offline fallback (precached, served for any failed
 * navigation — Arabic or /en). There is one document for both languages, so it
 * says it in both: Arabic first (this is the Arabic root layout), then English.
 */
export default function OfflinePage() {
  setRequestLocale("ar");
  const t = useTranslations("offline");
  const en = createTranslator({ locale: "en", messages: enMessages, namespace: "offline" });

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
        <hr aria-hidden="true" className="w-full border-ink/10" />
        <div lang="en" dir="ltr" className="flex flex-col items-center gap-4">
          <h2 className="text-xl">{en("title")}</h2>
          <p className="text-muted">{en("message")}</p>
          <a
            href="/en"
            hrefLang="en"
            className="press flex min-h-14 items-center justify-center rounded-2xl border-[1.5px] border-primary px-8 text-lg font-semibold text-brand"
          >
            {en("retry")}
          </a>
        </div>
      </div>
    </div>
  );
}

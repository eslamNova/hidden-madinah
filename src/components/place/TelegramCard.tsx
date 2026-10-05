import { useLocale, useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { TELEGRAM_CHANNEL } from "@/lib/constants";
import { langOf } from "@/lib/i18n";

/**
 * Quiet channel invite at the foot of the places list — the visitor has just
 * been through the whole catalogue, so "new places land here first" is the
 * natural next step rather than an interruption.
 *
 * Deliberately lighter than SeerahAppCard: one line of copy and a single link,
 * no gold rule and no button pair. The two must never read as competing
 * banners when a place page shows one and the list shows the other.
 *
 * The channel posts in Arabic; English pages say so in the same line.
 */
export function TelegramCard() {
  const t = useTranslations("telegram");
  const lang = langOf(useLocale());

  return (
    <section aria-label={t("title")} className="card-elevated p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-brand"
        >
          <Send className="h-5 w-5" />
        </span>
        <div className="min-w-0 sm:flex-1">
          <h2 className="text-lg leading-snug">{t("title")}</h2>
          <p className="text-muted">
            {t("description")}
            {lang === "en" && <> {t("arabicNote")}</>}
          </p>
        </div>
        <a
          href={TELEGRAM_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex min-h-12 items-center justify-center rounded-2xl border-[1.5px] border-ink/15 bg-surface px-5 text-base font-semibold text-ink shadow-sm sm:shrink-0"
        >
          {t("join")}
        </a>
      </div>
    </section>
  );
}

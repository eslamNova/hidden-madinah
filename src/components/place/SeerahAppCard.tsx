import { useLocale, useTranslations } from "next-intl";
import { BookOpenText, ExternalLink, Languages } from "lucide-react";
import { SEERAH_APP } from "@/lib/constants";
import { langOf } from "@/lib/i18n";

/**
 * Quiet companion-app card: the visitor just read a Seerah story at the place
 * where it happened — «سيرة» (free, third-party) tells the whole biography.
 * One card per place page, above the related-places grid; never a banner,
 * never a popup. Store links open externally.
 *
 * «سيرة» is an Arabic-only audio app. English pages still show the card (many
 * visitors to Madinah read some Arabic, or travel with family who do) but say
 * plainly that the app is in Arabic, so nobody installs it expecting English.
 */
export function SeerahAppCard() {
  const t = useTranslations("seerah");
  const lang = langOf(useLocale());

  return (
    <section aria-label={t("title")} className="card-elevated p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-brand"
        >
          <BookOpenText className="h-6 w-6" />
        </span>
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl leading-snug">{t("title")}</h2>
          <span aria-hidden="true" className="gold-rule block h-px w-16" />
          <p className="text-base leading-relaxed text-muted">{t("description")}</p>
          {lang === "en" && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-brand">
              <Languages aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("arabicOnly")}
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={SEERAH_APP.appStore}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex min-h-12 items-center gap-1.5 rounded-2xl border-[1.5px] border-ink/15 bg-surface px-5 text-base font-semibold text-ink shadow-sm"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              {t("appStore")}
            </a>
            <a
              href={SEERAH_APP.googlePlay}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex min-h-12 items-center gap-1.5 rounded-2xl border-[1.5px] border-ink/15 bg-surface px-5 text-base font-semibold text-ink shadow-sm"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              {t("googlePlay")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

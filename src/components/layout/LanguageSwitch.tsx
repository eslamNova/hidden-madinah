"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { hasEnglish, localizeHref, stripLang } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

/**
 * عربي ⇄ English for the page in view. A plain link (full load): each language
 * has its own root document (lang/dir), and the query string — e.g. a hotel
 * card's ?from= — is carried over at click time.
 */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const t = useTranslations("common");
  const lang = useLang();
  const pathname = usePathname();
  if (!hasEnglish(pathname)) return null;

  const target = lang === "ar" ? localizeHref(pathname, "en") : stripLang(pathname);
  const other = lang === "ar" ? "en" : "ar";

  return (
    <a
      href={target}
      hrefLang={other}
      lang={other}
      aria-label={t("switchLanguageLabel")}
      onClick={(e) => {
        const extra = window.location.search + window.location.hash;
        if (extra) {
          e.preventDefault();
          window.location.assign(target + extra);
        }
      }}
      className={`press flex h-12 items-center gap-1.5 rounded-full border px-3.5 font-semibold shadow-lg ${className}`}
    >
      <Languages aria-hidden="true" className="h-5 w-5" />
      {t("switchLanguage")}
    </a>
  );
}

import { getTranslations } from "next-intl/server";
import { BookOpen, ChevronDown } from "lucide-react";
import Link from "@/components/i18n/Link";
import { parseSamarrai } from "@/lib/citations";
import type { Lang } from "@/lib/i18n";
import type { PlaceClaim } from "@/lib/queries";

/** Shown open; the rest sit behind a native "show more" (no script needed). */
const VISIBLE = 5;

/**
 * «من وفاء الوفاء» — a place's verified claims, each with its volume and page
 * in the Dar al-Kutub al-'Ilmiyya edition and, when matched, the al-Samarrai
 * reference. Server-rendered, so the whole list is in the page's HTML (and
 * readable by search engines) even behind "show more".
 *
 * Callers pass only verified claims in the page's language (getPlaceClaims:
 * English pages get reviewed English only), and hide the section when none.
 */
export async function WafaClaims({ claims, lang }: { claims: PlaceClaim[]; lang: Lang }) {
  if (claims.length === 0) return null;
  const t = await getTranslations("place");
  const tj = await getTranslations("journey");

  const item = (c: PlaceClaim) => {
    const samarrai = c.samarrai ? parseSamarrai(c.samarrai) : null;
    const hadith = c.hadith ? `${c.hadith}${c.grading ? ` (${c.grading})` : ""}` : null;
    return (
      <li key={c.id} className="space-y-1 border-s-2 border-accent/60 ps-4">
        <p className="text-lg leading-relaxed">{c.text}</p>
        <p className="flex items-start gap-2 text-base text-muted">
          <BookOpen aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <span>
            {t("wafaRef", { vol: c.vol ?? "?", page: c.page ?? "?" })}
            {c.samarrai &&
              (lang === "ar" ? (
                ` · ${tj("samarraiRef", { ref: c.samarrai })}`
              ) : (
                <>
                  {" · "}
                  {samarrai ? tj("samarraiVolPage", samarrai) : <bdi lang="ar">{tj("samarraiRef", { ref: c.samarrai })}</bdi>}
                </>
              ))}
            {hadith &&
              (lang === "ar" ? (
                ` · ${hadith}`
              ) : (
                // Narration references stay as written in the source (Arabic).
                <>
                  {" · "}
                  <bdi lang="ar">{hadith}</bdi>
                </>
              ))}
          </span>
        </p>
      </li>
    );
  };

  const shown = claims.slice(0, VISIBLE);
  const more = claims.slice(VISIBLE);

  return (
    <section aria-labelledby="from-wafa" className="space-y-4">
      <h2 id="from-wafa" className="text-2xl">
        {t("wafaTitle")}
      </h2>
      <span aria-hidden="true" className="gold-rule block h-px w-16" />
      <p className="leading-relaxed text-muted">{t("wafaIntro")}</p>
      <ol className="space-y-4">{shown.map(item)}</ol>
      {more.length > 0 && (
        <details className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold text-brand [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" className="h-5 w-5 transition-transform group-open:rotate-180" />
            <span className="group-open:hidden">{t("wafaMore", { count: more.length })}</span>
            <span className="hidden group-open:inline">{t("wafaLess")}</span>
          </summary>
          <ol start={VISIBLE + 1} className="mt-3 space-y-4">
            {more.map(item)}
          </ol>
        </details>
      )}
      <Link href="/sources" className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4">
        {t("wafaMethod")}
      </Link>
    </section>
  );
}

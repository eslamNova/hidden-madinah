import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ExternalLink, Mail, Send } from "lucide-react";
import { CONTACT_EMAIL, sourcesUpdated, TELEGRAM_CHANNEL, WAFA_BOOK } from "@/lib/constants";
import type { Lang } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-metadata";
import { jsonLdGraph, pageUrl, wafaBookId, wafaBookNode, websiteId } from "@/lib/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * /sources and /en/sources — «المصادر ومنهج التحقق»: the book and edition,
 * the al-Samarrai cross-check, how claims are drafted and validated, human
 * review, the AI guide's rule, the English translation's status, and how to
 * report an error. A plain summary of SOURCES.md for visitors; it is also
 * the site's schema.org publishingPrinciples.
 *
 * The wording (messages: sources.*, both languages) was approved by the owner
 * on 16 October 2026.
 */
export async function sourcesMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("sources");
  return pageMetadata({ lang, path: "/sources", title: t("title"), description: t("metaDescription") });
}

function Section({ id, heading, children }: { id?: string; heading: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-20 space-y-3">
      <h2 id={id ? `${id}-title` : undefined} className="text-xl">
        {heading}
      </h2>
      {children}
    </section>
  );
}

const linkClass = "inline-flex min-h-11 items-center gap-2 font-medium text-brand underline underline-offset-4";

export async function SourcesView({ lang }: { lang: Lang }) {
  const t = await getTranslations("sources");
  const url = pageUrl("/sources", lang);

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 pb-8 pt-10">
      <header className="space-y-3">
        <h1 className="text-3xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("intro")}</p>
        <p className="text-sm text-muted-decorative">{t("updated", { date: sourcesUpdated(lang) })}</p>
      </header>

      {/* The anchor of the site-wide schema.org Book entry (wafaBookId). */}
      <Section id="wafa-al-wafa" heading={t("bookTitle")}>
        <p className="leading-relaxed text-muted">{t("bookBody")}</p>
        <a href={WAFA_BOOK.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
          <ExternalLink aria-hidden="true" className="h-5 w-5 shrink-0" />
          {t("bookLink")}
        </a>
      </Section>

      <Section heading={t("whyTitle")}>
        <p className="leading-relaxed text-muted">{t("whyBody")}</p>
      </Section>

      <Section heading={t("samarraiTitle")}>
        <p className="leading-relaxed text-muted">{t("samarraiBody")}</p>
      </Section>

      <Section heading={t("draftingTitle")}>
        <p className="leading-relaxed text-muted">{t("draftingBody")}</p>
      </Section>

      <Section heading={t("reviewTitle")}>
        <p className="leading-relaxed text-muted">{t("reviewBody")}</p>
      </Section>

      <Section heading={t("guideTitle")}>
        <p className="leading-relaxed text-muted">{t("guideBody")}</p>
      </Section>

      <Section heading={t("placeTextsTitle")}>
        <p className="leading-relaxed text-muted">{t("placeTextsBody")}</p>
      </Section>

      <Section heading={t("englishTitle")}>
        <p className="leading-relaxed text-muted">{t("englishBody")}</p>
      </Section>

      <Section heading={t("citeTitle")}>
        <p className="leading-relaxed text-muted">{t("citeBody")}</p>
      </Section>

      <Section id="report" heading={t("reportTitle")}>
        <p className="leading-relaxed text-muted">{t("reportBody")}</p>
        <div className="flex flex-col items-start gap-1">
          <a href={TELEGRAM_CHANNEL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <Send aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t("reportTelegram")}
          </a>
          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
              <Mail aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className="ltr-nums">{CONTACT_EMAIL}</span>
            </a>
          )}
        </div>
      </Section>

      <JsonLd
        data={jsonLdGraph(
          {
            "@type": "AboutPage",
            "@id": `${url}#page`,
            url,
            name: t("title"),
            description: t("metaDescription"),
            inLanguage: lang,
            isPartOf: { "@id": websiteId(lang) },
            about: { "@id": wafaBookId() },
          },
          wafaBookNode(lang)
        )}
      />
    </div>
  );
}

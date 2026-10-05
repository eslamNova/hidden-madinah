import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { Route } from "lucide-react";
import Link from "@/components/i18n/Link";
import { HERO_IMAGES } from "@/lib/hero-images";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { getHumaneStories } from "@/lib/stories";
import { PageHero } from "@/components/layout/PageHero";
import { StoryBrowser } from "@/components/stories/StoryBrowser";

/**
 * /stories and /en/stories — «القصص الإنسانية»: verified humane stories from
 * Wafa al-Wafa, by theme. The route files set the request locale before
 * rendering. English shows only stories whose English was reviewed; the rest
 * stay one tap away in Arabic.
 */
export async function storiesMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("stories");
  return { title: t("title"), description: t("subtitle"), alternates: languageAlternates("/stories", lang) };
}

export async function StoriesView({ lang }: { lang: Lang }) {
  const t = await getTranslations("stories");
  const tc = await getTranslations("common");
  const { stories, groups, untranslated } = await getHumaneStories(lang);
  const day = Math.floor(Date.now() / 86_400_000);

  // next/link, not the localizing Link: this one must stay on the Arabic URL.
  const arabicLink = (
    <NextLink href="/stories" hrefLang="ar" className="font-semibold text-brand underline">
      {t("openArabic")}
    </NextLink>
  );

  return (
    <>
      <PageHero photo={HERO_IMAGES[(day + 5) % HERO_IMAGES.length] ?? null} title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-10 pt-8">
        <p className="text-lg leading-relaxed">{t("intro")}</p>
        {lang === "en" && stories.length > 0 && <p className="text-sm leading-relaxed text-muted">{tc("translationNote")}</p>}

        {stories.length === 0 ? (
          <div className="card-elevated space-y-4 p-8 text-center text-lg">
            {lang === "en" && untranslated > 0 ? (
              <>
                <p className="text-muted">{t("notInEnglish")}</p>
                <p>{arabicLink}</p>
              </>
            ) : (
              <>
                <p className="text-muted">{t("empty")}</p>
                <Link
                  href="/places"
                  className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 font-semibold text-paper"
                >
                  {t("emptyCta")}
                </Link>
              </>
            )}
          </div>
        ) : (
          <StoryBrowser stories={stories} groups={groups} />
        )}

        {lang === "en" && stories.length > 0 && untranslated > 0 && (
          <p className="text-center text-muted">
            {t("moreInArabic")} {arabicLink}
          </p>
        )}

        {stories.length > 0 && (
          <Link
            href="/journeys"
            className="card-lift flex min-h-12 items-center gap-3 rounded-2xl bg-basalt p-5 text-lg font-semibold text-paper shadow-md"
          >
            <Route aria-hidden="true" className="h-6 w-6 shrink-0 text-accent" />
            {t("journeysCta")}
          </Link>
        )}
      </div>
    </>
  );
}

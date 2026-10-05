import type { Metadata } from "next";
import NextLink from "next/link";
import Link from "@/components/i18n/Link";
import { getTranslations } from "next-intl/server";
import { BookHeart, ChevronLeft, Clock, Footprints } from "lucide-react";
import { coverImage } from "@/lib/content";
import { HERO_IMAGES } from "@/lib/hero-images";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { hasEnglishVersion, journeyTexts } from "@/lib/journey-view";
import { getPublishedJourneys } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";
import { JourneyTagFilter, type JourneyTagOption } from "@/components/journey/JourneyTagFilter";

/** Tags with a reviewed label, in chip order; any other tag sorts after them. */
const KNOWN_TAGS = ["first-time", "family", "evening", "seasonal", "ramadan", "hajj"];

/** One spelling per tag: admins type them by hand ("Family ", "family"). */
const normalizeTags = (tags: string[] | null | undefined) =>
  [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];

/**
 * /journeys and /en/journeys. The route files set the request locale before
 * rendering. English lists only the journeys that have an English version;
 * the rest stay one tap away in Arabic.
 */
export async function journeysMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("journey");
  return { title: t("listTitle"), description: t("listSubtitle"), alternates: languageAlternates("/journeys", lang) };
}

export async function JourneysView({ lang }: { lang: Lang }) {
  const t = await getTranslations("journey");
  const tp = await getTranslations("plan");
  const all = await getPublishedJourneys(lang);
  const journeys = lang === "en" ? all.filter(hasEnglishVersion) : all;
  const arabicOnly = all.length - journeys.length;

  // Unknown tags still filter, under a readable form of their own spelling
  // ("night-walk" → "night walk") rather than a missing-message key.
  const tagLabel = (tag: string) => (t.has(`tags.${tag}`) ? t(`tags.${tag}`) : tag.replace(/[-_]+/g, " "));
  const tagsOf = new Map(journeys.map((j) => [j.id, normalizeTags(j.tags)]));
  const rank = (tag: string) => (KNOWN_TAGS.includes(tag) ? KNOWN_TAGS.indexOf(tag) : KNOWN_TAGS.length);
  const tagOptions: JourneyTagOption[] = [...new Set([...tagsOf.values()].flat())]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((value) => ({ value, label: tagLabel(value) }));

  const items = journeys.map((j) => {
    const cover = coverImage(j.stops.flatMap((s) => s.place?.media ?? []));
    const { title, subtitle } = journeyTexts(j, lang);
    const tags = tagsOf.get(j.id) ?? [];
    const card = (
      <Link
        href={`/journeys/${encodeURIComponent(j.slug)}`}
        className="card-lift relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
      >
        {cover ? (
          <PlaceImage media={cover} alt="" sizes="(max-width: 768px) 92vw, 720px" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <PlaceholderImage category="mosque" className="aspect-[16/9] w-full" />
        )}
        <div aria-hidden="true" className="scrim absolute inset-0" />
        {tags.length > 0 && (
          <ul aria-label={t("tagsLabel")} className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag} className="rounded-full bg-basalt/80 px-3 py-1 text-sm font-medium text-paper">
                {tagLabel(tag)}
              </li>
            ))}
          </ul>
        )}
        <div className="absolute inset-x-0 bottom-0 space-y-1 p-5">
          <span className="flex flex-wrap items-center gap-x-3 text-sm font-medium text-accent">
            <span className="flex items-center gap-1">
              <Footprints aria-hidden="true" className="h-4 w-4" />
              {t("stopsCount", { count: j.stops.length })}
            </span>
            {j.duration_min && (
              <span className="flex items-center gap-1">
                <Clock aria-hidden="true" className="h-4 w-4" />
                <span>{t("duration", { min: j.duration_min })}</span>
              </span>
            )}
          </span>
          <h2 className="text-2xl text-paper">{title}</h2>
          {subtitle && <p className="line-clamp-2 text-base leading-relaxed text-paper/80">{subtitle}</p>}
        </div>
      </Link>
    );
    return { id: j.id, tags, card };
  });

  const day = Math.floor(Date.now() / 86_400_000);
  const heroPhoto =
    coverImage(journeys[0]?.stops.flatMap((s) => s.place?.media ?? []) ?? []) ??
    HERO_IMAGES[(day + 1) % HERO_IMAGES.length] ??
    null;

  // next/link, not the localizing Link: this one must stay on the Arabic URL.
  const arabicLink = (
    <NextLink href="/journeys" hrefLang="ar" className="font-semibold text-brand underline">
      {t("openArabic")}
    </NextLink>
  );

  return (
    <>
      <PageHero photo={heroPhoto} title={t("listTitle")} subtitle={t("listSubtitle")}>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/plan" className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 font-semibold text-basalt">
            {tp("cta")}
          </Link>
          <Link href="/my-journey" className="inline-flex min-h-11 items-center rounded-full bg-paper/15 px-4 font-medium text-paper">
            {t("myJourney")}
          </Link>
        </div>
      </PageHero>
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 pt-8">
        {journeys.length === 0 ? (
          arabicOnly > 0 ? (
            <div className="card-elevated space-y-3 p-8 text-center text-lg">
              <p className="text-muted">{t("listNotInEnglish")}</p>
              <p>{arabicLink}</p>
            </div>
          ) : (
            <p className="card-elevated p-8 text-center text-lg text-muted">{t("listEmpty")}</p>
          )
        ) : (
          <JourneyTagFilter tags={tagOptions} items={items} />
        )}
        {journeys.length > 0 && arabicOnly > 0 && (
          <p className="text-center text-muted">
            {t("moreInArabic")} {arabicLink}
          </p>
        )}

        {/* The humane stories live on their own page; journeys are where a
            visitor looking for them would start. */}
        <Link href="/stories" className="card-elevated card-lift flex min-h-20 items-center gap-4 p-5">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-brand">
            <BookHeart className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block text-xl font-semibold">{t("storiesCardTitle")}</span>
            <span className="block leading-relaxed text-muted">{t("storiesCardText")}</span>
          </span>
          <ChevronLeft aria-hidden="true" className="h-6 w-6 shrink-0 text-brand ltr:-scale-x-100" />
        </Link>
      </div>
    </>
  );
}

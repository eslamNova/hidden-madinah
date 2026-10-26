import { getTranslations } from "next-intl/server";
import { articleText } from "@/lib/article-html";
import { getArticle, getPublishedArticles } from "@/lib/articles";
import { parseSamarrai, storyAnchor } from "@/lib/citations";
import { SITE_DESCRIPTION, SITE_DESCRIPTION_EN, SITE_NAME, SITE_NAME_EN, WAFA_BOOK } from "@/lib/constants";
import { toPublicPlaceView } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { localizeJourney } from "@/lib/i18n-content";
import { hasEnglishVersion, journeyTexts, toPlayerJourney, type StopSource } from "@/lib/journey-view";
import { googleMapsUrl } from "@/lib/maps";
import {
  getAllPlaceClaims,
  getJourney,
  getPublishedJourneys,
  getPublishedPlaces,
  getRoutesWithStops,
  type PlaceClaim,
  type PlaceWithMedia,
} from "@/lib/queries";
import { getHumaneStories } from "@/lib/stories";
import { absoluteUrl, pageUrl } from "@/lib/structured-data";

/**
 * /llms.txt and /llms-full.txt (llmstxt.org): a plain-text map of the site for
 * AI agents, in Arabic and English. llms.txt lists every place, journey,
 * route, story theme and published article with its URL in both languages;
 * llms-full.txt adds their public text.
 *
 * Only what the pages themselves show goes in: place texts from the cleaned
 * public view ([VERIFY] stripped), claims and stories that a reviewer
 * approved (RLS returns nothing else to the anon client), English only where
 * the English pages show it. Wording comes from messages (llms.*, sources and
 * page namespaces), so both languages stay in step with the site.
 */

type T = Awaited<ReturnType<typeof getTranslations>>;
const LANGS: Lang[] = ["ar", "en"];

/** Text on one line, without Markdown link brackets. */
const flat = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").replace(/[[\]]/g, "").trim();

const link = (text: string, url: string) => `[${flat(text)}](${url})`;

/** "- [name](url): description" (llmstxt.org list item). */
const item = (text: string, url: string, description?: string | null) =>
  `- ${link(text, url)}${description && flat(description) ? `: ${flat(description)}` : ""}`;

const placePath = (slug: string) => `/places/${encodeURIComponent(slug)}`;

async function translators(namespace: string): Promise<Record<Lang, T>> {
  const [ar, en] = await Promise.all(LANGS.map((locale) => getTranslations({ locale, namespace })));
  return { ar, en };
}

type Site = Awaited<ReturnType<typeof loadSite>>;

async function loadSite() {
  const [placesAr, placesEn, routesAr, routesEn, journeysAr, storiesAr, storiesEn, articlesAr, articlesEn] = await Promise.all([
    getPublishedPlaces("ar"),
    getPublishedPlaces("en"),
    getRoutesWithStops("ar"),
    getRoutesWithStops("en"),
    getPublishedJourneys("ar"),
    getHumaneStories("ar"),
    getHumaneStories("en"),
    getPublishedArticles("ar"),
    getPublishedArticles("en"),
  ]);
  const [llms, sources, places, place, journey, routes, stories, blog, plan, map, tour, privacy, common] = await Promise.all(
    ["llms", "sources", "places", "place", "journey", "routes", "stories", "blog", "plan", "map", "tour", "privacy", "common"].map(translators)
  );
  return {
    places: { ar: placesAr, en: placesEn },
    routes: { ar: routesAr, en: routesEn },
    journeys: journeysAr,
    stories: { ar: storiesAr, en: storiesEn },
    articles: { ar: articlesAr.articles, en: articlesEn.articles },
    t: { llms, sources, places, place, journey, routes, stories, blog, plan, map, tour, privacy, common },
  };
}

/** Title, summary, policy, citation rule and off-limits paths: the head both files share. */
function header(site: Site, fullText: boolean): string[] {
  const { llms } = site.t;
  const out = [
    `# ${SITE_NAME} | ${SITE_NAME_EN}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    `>`,
    `> ${SITE_DESCRIPTION_EN}`,
    "",
    llms.ar("about"),
    "",
    llms.en("about"),
    "",
    `## ${llms.ar("policyTitle")} | ${llms.en("policyTitle")}`,
    "",
  ];
  for (const lang of LANGS) {
    for (const key of ["policyPrimary", "policySamarrai", "policyReview", "policyGuide", "policyPlaceTexts", "policyEnglish"]) {
      out.push(`- ${llms[lang](key, { book: WAFA_BOOK.url })}`);
    }
    out.push(`- ${link(site.t.sources[lang]("title"), pageUrl("/sources", lang))}`);
    out.push("");
  }
  out.push(`## ${llms.ar("citeTitle")} | ${llms.en("citeTitle")}`, "", llms.ar("citeBody"), "", llms.en("citeBody"), "");
  out.push(`## ${llms.ar("privateTitle")} | ${llms.en("privateTitle")}`, "", llms.ar("privateBody"), "", llms.en("privateBody"), "");
  if (!fullText) {
    out.push(`- ${link(llms.ar("fullText"), absoluteUrl("/llms-full.txt"))}`, `- ${link(llms.en("fullText"), absoluteUrl("/llms-full.txt"))}`, "");
  }
  return out;
}

/** One list item per entity and language. */
function lists(site: Site): string[] {
  const { t } = site;
  const out: string[] = [];
  const section = (titleKey: string, lines: string[], emptyKey?: string) => {
    out.push(`## ${t.llms.ar(titleKey)} | ${t.llms.en(titleKey)}`, "");
    if (lines.length) out.push(...lines);
    else if (emptyKey) out.push(t.llms.ar(emptyKey), t.llms.en(emptyKey));
    out.push("");
  };

  const enPlace = new Map(site.places.en.map((p) => [p.slug, p]));
  section(
    "placesTitle",
    site.places.ar.flatMap((p) => {
      const en = enPlace.get(p.slug);
      return [
        item(p.name_ar, pageUrl(placePath(p.slug), "ar"), toPublicPlaceView(p, null).summary),
        ...(en ? [item(en.name_ar, pageUrl(placePath(p.slug), "en"), toPublicPlaceView(en, null).summary)] : []),
      ];
    })
  );

  section(
    "journeysTitle",
    site.journeys.flatMap((j) => {
      const path = `/journeys/${encodeURIComponent(j.slug)}`;
      const ar = journeyTexts(j, "ar");
      const lines = [item(ar.title, pageUrl(path, "ar"), ar.subtitle)];
      // Only a journey with a complete English version has an English page.
      if (hasEnglishVersion(j)) {
        const en = journeyTexts(localizeJourney(j, "en"), "en");
        lines.push(item(en.title, pageUrl(path, "en"), en.subtitle));
      }
      return lines;
    }),
    "noJourneys"
  );

  const enRoute = new Map(site.routes.en.map((r) => [r.slug, r]));
  section(
    "routesTitle",
    site.routes.ar.flatMap((r) => {
      const path = `/routes/${encodeURIComponent(r.slug)}`;
      const en = enRoute.get(r.slug);
      const stops = (lang: Lang, names: string[]) => `${t.routes[lang]("stopsCount", { count: names.length })}: ${names.join(lang === "ar" ? "، " : ", ")}`;
      return [
        item(r.title_ar, pageUrl(path, "ar"), stops("ar", r.stops.map((s) => s.name_ar))),
        ...(en ? [item(en.title_ar, pageUrl(path, "en"), stops("en", en.stops.map((s) => s.name_ar)))] : []),
      ];
    })
  );

  section(
    "themesTitle",
    LANGS.flatMap((lang) =>
      site.stories[lang].groups.map((g) =>
        item(
          t.stories[lang](`themes.${g.theme}`),
          `${pageUrl("/stories", lang)}?theme=${g.theme}`,
          t.stories[lang]("count", { count: g.count })
        )
      )
    ),
    "noStories"
  );

  section(
    "articlesTitle",
    LANGS.flatMap((lang) => site.articles[lang].map((a) => item(a.title, pageUrl(`/blog/${a.slug}`, lang), a.excerpt))),
    "noArticles"
  );

  const pages: [string, string, (lang: Lang) => string][] = [
    ["/places", "places", (l) => t.places[l]("metaDescription")],
    ["/map", "map", (l) => t.map[l]("metaDescription")],
    ["/tour", "tour", (l) => t.tour[l]("metaDescription")],
    ["/journeys", "journey", (l) => t.journey[l]("listSubtitle")],
    ["/stories", "stories", (l) => t.stories[l]("subtitle")],
    ["/blog", "blog", (l) => t.blog[l]("subtitle")],
    ["/plan", "plan", (l) => t.plan[l]("subtitle")],
    ["/sources", "sources", (l) => t.sources[l]("metaDescription")],
    ["/privacy", "privacy", (l) => t.privacy[l]("intro")],
  ];
  const titleKey: Record<string, string> = { journey: "listTitle" };
  section(
    "pagesTitle",
    LANGS.flatMap((lang) =>
      pages.map(([path, ns, desc]) =>
        item(t[ns as keyof Site["t"]][lang](titleKey[ns] ?? "title"), pageUrl(path, lang), desc(lang))
      )
    )
  );
  return out;
}

export async function llmsTxt(): Promise<string> {
  const site = await loadSite();
  return [...header(site, false), ...lists(site)].join("\n");
}

// ── llms-full.txt ──────────────────────────────────────────────────────────

/** «وفاء الوفاء جX صY», with the al-Samarrai reference and any narration reference. */
function citation(
  lang: Lang,
  t: Site["t"],
  c: { vol: number | null; page: number | null; samarrai: string | null; hadith: string | null; grading: string | null },
  refKey: "place" | "journey"
): string {
  const ref =
    refKey === "place"
      ? t.place[lang]("wafaRef", { vol: c.vol ?? "?", page: c.page ?? "?" })
      : t.journey[lang]("sourceRef", { vol: c.vol ?? "?", page: c.page ?? "?" });
  const parsed = parseSamarrai(c.samarrai);
  const samarrai = c.samarrai
    ? lang === "en" && parsed
      ? t.journey.en("samarraiVolPage", parsed)
      : t.journey[lang]("samarraiRef", { ref: c.samarrai })
    : null;
  const hadith = c.hadith ? `${c.hadith}${c.grading ? ` (${c.grading})` : ""}` : null;
  return [ref, samarrai, hadith].filter(Boolean).join(" · ");
}

function placeFull(site: Site, lang: Lang, p: PlaceWithMedia, claims: PlaceClaim[]): string[] {
  const { t } = site;
  const v = toPublicPlaceView(p, googleMapsUrl(p));
  const out = [`### ${v.name_ar}`, "", pageUrl(placePath(p.slug), lang), ""];
  if (lang === "en") out.push(t.common.en("translationNote"), "");
  const field = (label: string, text: string | null) => {
    if (text) out.push(`#### ${label}`, "", text, "");
  };
  if (v.summary) out.push(v.summary, "");
  if (v.quote) out.push(`> ${flat(v.quote)}${v.quoteSource ? ` — ${flat(v.quoteSource)}` : ""}`, "");
  if (v.distanceKm != null) out.push(`- ${t.common[lang]("distanceKm", { km: v.distanceKm })}`);
  if (v.driveTimeMin != null) out.push(`- ${t.common[lang]("driveTime", { min: v.driveTimeMin })}`);
  if (v.lat != null && v.lng != null) out.push(`- ${v.lat}, ${v.lng}`);
  if (v.distanceKm != null || v.lat != null) out.push("");
  field(t.place[lang]("story"), v.story);
  field(t.place[lang]("virtue"), v.virtue);
  if (claims.length) {
    out.push(`#### ${t.place[lang]("wafaTitle")}`, "");
    for (const c of claims) out.push(`- ${flat(c.text)} (${citation(lang, t, c, "place")})`);
    out.push("");
  }
  field(t.place[lang]("tips"), v.tips);
  field(t.place[lang]("howToGet"), v.howToGet);
  field(t.place[lang]("bestTime"), v.bestTime);
  field(t.place[lang]("openStatus"), v.openStatus);
  return out;
}

async function journeysFull(site: Site): Promise<string[]> {
  const { t } = site;
  const out: string[] = [];
  for (const j of site.journeys) {
    for (const lang of LANGS) {
      if (lang === "en" && !hasEnglishVersion(j)) continue;
      const full = await getJourney(j.slug, { lang });
      if (!full || !full.is_published) continue;
      const view = toPlayerJourney(full, lang);
      out.push(`### ${view.title}`, "", pageUrl(`/journeys/${encodeURIComponent(j.slug)}`, lang), "");
      if (lang === "en") out.push(t.common.en("translationNote"), "");
      if (view.intro) out.push(view.intro, "");
      for (const s of view.stops) {
        out.push(`#### ${t.journey[lang]("stopOf", { n: s.index, total: view.stops.length })}: ${s.title}`, "");
        if (s.placeSlug) out.push(pageUrl(placePath(s.placeSlug), lang), "");
        if (s.script) out.push(s.script, "");
        if (s.humanMoment) out.push(`${t.journey[lang]("humanMoment")}: ${s.humanMoment}`, "");
        const sources = s.sources.filter((src: StopSource) => src.textLang === lang);
        for (const src of sources) out.push(`- ${flat(src.text)} (${citation(lang, t, src, "journey")})`);
        if (sources.length) out.push("");
      }
    }
  }
  return out;
}

function storiesFull(site: Site): string[] {
  const { t } = site;
  const out: string[] = [];
  for (const lang of LANGS) {
    const { stories } = site.stories[lang];
    if (!stories.length) continue;
    out.push(`### ${t.stories[lang]("title")}`, "", pageUrl("/stories", lang), "");
    if (lang === "en") out.push(t.common.en("translationNote"), "");
    for (const s of stories) {
      const ref = [
        t.stories[lang]("source", { vol: s.vol ?? "?", page: s.page ?? "?" }),
        s.hadithRef ? `${s.hadithRef}${s.grading ? ` (${s.grading})` : ""}` : null,
        s.place ? s.place.name : s.topic ? t.stories[lang](`topics.${s.topic}`) : null,
      ].filter(Boolean);
      out.push(`- ${flat(s.text)} (${ref.join(" · ")}) ${pageUrl("/stories", lang)}#${storyAnchor(s.id)}`);
    }
    out.push("");
  }
  return out;
}

async function articlesFull(site: Site): Promise<string[]> {
  const { t } = site;
  const out: string[] = [];
  for (const lang of LANGS) {
    for (const summary of site.articles[lang]) {
      const a = await getArticle(summary.slug, lang);
      if (!a || !a.available) continue;
      out.push(`### ${a.title}`, "", pageUrl(`/blog/${a.slug}`, lang), "");
      if (a.excerpt) out.push(a.excerpt, "");
      if (a.body) out.push(articleText(a.body, lang), "");
      if (a.sources.length) {
        out.push(`#### ${t.blog[lang]("sourcesTitle")}`, "");
        for (const s of a.sources) out.push(`- ${t.blog[lang]("sourceRef", { vol: s.vol, page: s.page })}${s.note ? ` — ${flat(s.note)}` : ""}`);
        out.push("");
      }
    }
  }
  return out;
}

export async function llmsFullTxt(): Promise<string> {
  const site = await loadSite();
  const { llms } = site.t;
  const [claimsAr, claimsEn] = await Promise.all([getAllPlaceClaims("ar"), getAllPlaceClaims("en")]);
  const enPlace = new Map(site.places.en.map((p) => [p.slug, p]));

  const out = [...header(site, true), ...lists(site)];
  out.push(`## ${llms.ar("placesFullTitle")} | ${llms.en("placesFullTitle")}`, "");
  for (const p of site.places.ar) {
    out.push(...placeFull(site, "ar", p, claimsAr.get(p.id) ?? []));
    const en = enPlace.get(p.slug);
    if (en) out.push(...placeFull(site, "en", en, claimsEn.get(p.id) ?? []));
  }
  out.push(`## ${llms.ar("journeysFullTitle")} | ${llms.en("journeysFullTitle")}`, "", ...(await journeysFull(site)));
  out.push(`## ${llms.ar("storiesFullTitle")} | ${llms.en("storiesFullTitle")}`, "", ...storiesFull(site));
  const articles = await articlesFull(site);
  out.push(`## ${llms.ar("articlesFullTitle")} | ${llms.en("articlesFullTitle")}`, "");
  out.push(...(articles.length ? articles : [llms.ar("noArticles"), llms.en("noArticles"), ""]));
  return out.join("\n");
}

/** A text/plain response for the route handlers. */
export const plainText = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

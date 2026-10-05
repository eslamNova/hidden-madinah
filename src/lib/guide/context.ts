import { createClient } from "@supabase/supabase-js";
import type { Database, Json, Tables } from "@/lib/database.types";
import { parseTransportOptions, stripVerify, type TransportOption } from "@/lib/content";
import { PROPHETS_MOSQUE, driveMinutes, formatDistance, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";
import type { Lang } from "@/lib/i18n";
import { localizePlace } from "@/lib/i18n-content";

/**
 * Builds everything the guide may say, in code, before the model sees it:
 *   - verified claims (the only allowed source for history/religion), tagged [C<id>]
 *   - practical facts computed here (distances, times, transport, opening, access)
 * The model never computes a distance or recalls a fact from memory.
 *
 * Written in the page's language: Arabic pages get exactly the Arabic below;
 * English pages get the same facts with English labels and place names, each
 * claim's reviewed English next to its Arabic, and the sources' English titles
 * for the citation list.
 */

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/** Journey stops with no place row (the Prophet's Mosque) draw on topic claims. */
export const NULL_PLACE_TOPIC = "nabawi";

export type GuideClaim = Pick<
  Tables<"claims">,
  "id" | "place_id" | "topic" | "text_ar" | "text_en" | "en_reviewed" | "source_id" | "vol" | "page" | "samarrai_ref" | "hadith_ref" | "grading" | "content_level" | "kind" | "quote_ar"
>;

type GuidePlace = Pick<
  Tables<"places">,
  "id" | "slug" | "name_ar" | "name_en" | "lat" | "lng" | "transport_options" | "opening_hours" | "open_status_ar" | "has_stairs" | "wheelchair_ok" | "walking_effort" | "visit_minutes" | "best_time_ar"
>;

export type GuideRequestContext = {
  place?: string;          // place slug
  journey?: string;        // journey slug
  stop?: number;           // 1-based stop order within the journey
  location?: LatLng;       // visitor location, only if they shared it
  lang?: Lang;             // the page's language (default Arabic)
};

export type CitationInfo = {
  id: number;
  place: string;
  vol: number | null;
  page: number | null;
  samarrai: string | null;
  hadith: string | null;
  grading: string | null;
  quote: string | null;
  /** English pages only: the cited book's English title and author, when the sources table has them. */
  source?: { title: string; author: string | null };
};

export type GuideContext = {
  label: string;                       // where the visitor is (for logs; "en:" prefix on English pages)
  factsBlock: string;                  // [C] claims, one per line
  practicalBlock: string;              // computed practical facts
  claims: Map<number, CitationInfo>;   // allowed citation ids
};

/** Every sentence the context is built from, per language. */
type Phrases = {
  openAlways: string;
  openDaily: (spans: string[]) => string;
  openUnknown: string;
  stairs: string;
  noStairs: string;
  wheelchair: string;
  effort: (level: string) => string;
  visitMinutes: (min: number) => string;
  accessJoin: string;
  accessUnknown: string;
  leg: (distance: string, walk: number, drive: number) => string;
  journey: (title: string, stops: number) => string;
  here: (title: string) => string;
  nextStop: (title: string, leg: string | null) => string;
  lastStop: string;
  fromVisitor: (title: string, leg: string) => string;
  nearVisitorItem: (name: string, distance: string, walk: number) => string;
  nearVisitor: (items: string[]) => string;
  nearHereItem: (name: string, distance: string, walk: number, drive: number) => string;
  nearHere: (items: string[]) => string;
  opening: (name: string, text: string) => string;
  access: (name: string, text: string) => string;
  transportItem: (o: TransportOption) => string;
  transport: (name: string, items: string[]) => string;
  bestTime: (text: string) => string;
  fromMosque: (distance: string) => string;
  mosque: string;
  hadith: (ref: string, grading: string | null) => string;
  level: (level: string) => string;
  humane: string;
  virtue: string;
  factJoin: string;
  noFacts: string;
};

const EFFORT_AR: Record<string, string> = { low: "قليل", medium: "متوسط", high: "مرتفع" };
const EFFORT_EN: Record<string, string> = { low: "low", medium: "moderate", high: "high" };

/** English sentences end with our own period: drop the one a translated text already has. */
const sentence = (text: string) => text.replace(/[\s.]+$/, "");

const fare = (o: TransportOption, unit: string) =>
  o.min_sar != null ? ` ${o.min_sar}${o.max_sar != null ? `–${o.max_sar}` : ""} ${unit}` : "";

const PHRASES: Record<Lang, Phrases> = {
  ar: {
    openAlways: "مفتوح على مدار اليوم",
    openDaily: (spans) => `يوميًا ${spans.join("، ")}`,
    openUnknown: "غير متوفرة لدينا — قل ذلك صراحة إن سُئلت",
    stairs: "فيه درج",
    noStairs: "بلا درج",
    wheelchair: "مناسب للكراسي المتحركة",
    effort: (level) => `جهد المشي: ${EFFORT_AR[level] ?? level}`,
    visitMinutes: (min) => `مدة الزيارة المقترحة: ${min} دقيقة`,
    accessJoin: "، ",
    accessUnknown: "معلومات سهولة الوصول غير متوفرة لدينا",
    leg: (distance, walk, drive) => `${distance} تقريبًا (نحو ${walk} دقيقة مشيًا، أو ${drive} دقائق بالسيارة)`,
    journey: (title, stops) => `الرحلة: «${title}» (${stops} محطات).`,
    here: (title) => `الزائر الآن عند: ${title}.`,
    nextStop: (title, leg) => (leg ? `المحطة التالية في الرحلة: ${title} — ${leg}.` : `المحطة التالية في الرحلة: ${title}.`),
    lastStop: "هذه آخر محطة في الرحلة.",
    fromVisitor: (title, leg) => `المسافة من موقع الزائر إلى ${title}: ${leg}.`,
    nearVisitorItem: (name, distance, walk) => `${name}: ${distance} (نحو ${walk} دقيقة مشيًا)`,
    nearVisitor: (items) => `أقرب المواضع إلى موقع الزائر: ${items.join("؛ ")}.`,
    nearHereItem: (name, distance, walk, drive) => `${name}: ${distance} (نحو ${walk} دقيقة مشيًا، ${drive} بالسيارة)`,
    nearHere: (items) => `أقرب المواضع من هنا: ${items.join("؛ ")}.`,
    opening: (name, text) => `أوقات الفتح (${name}): ${text}.`,
    access: (name, text) => `سهولة الوصول (${name}): ${text}.`,
    transportItem: (o) => `${o.mode_ar}${fare(o, "ريال")}${o.note_ar ? ` (${o.note_ar})` : ""}`,
    transport: (name, items) => `المواصلات إلى ${name} من المسجد النبوي: ${items.join("؛ ")}.`,
    bestTime: (text) => `أفضل وقت للزيارة: ${text}.`,
    fromMosque: (distance) => `المسافة من المسجد النبوي: ${distance}.`,
    mosque: "المسجد النبوي",
    hadith: (ref, grading) => `التخريج: ${ref}${grading ? ` (${grading})` : ""}`,
    level: (level) => `المستوى ${level}`,
    humane: "موقف إنساني",
    virtue: "فضل",
    factJoin: "؛ ",
    noFacts: "(لا توجد معلومات معتمدة بعد لهذا الموضع)",
  },
  en: {
    openAlways: "open around the clock",
    openDaily: (spans) => `daily ${spans.join(", ")}`,
    openUnknown: "not available to us — say so plainly if asked",
    stairs: "has stairs",
    noStairs: "no stairs",
    wheelchair: "suitable for wheelchairs",
    effort: (level) => `walking effort: ${EFFORT_EN[level] ?? level}`,
    visitMinutes: (min) => `suggested visit length: ${min} minutes`,
    accessJoin: ", ",
    accessUnknown: "accessibility information is not available to us",
    leg: (distance, walk, drive) => `about ${distance} (around ${walk} min on foot, or ${drive} min by car)`,
    journey: (title, stops) => `Journey: "${title}" (${stops} stops).`,
    here: (title) => `The visitor is now at: ${title}.`,
    nextStop: (title, leg) => (leg ? `Next stop on the journey: ${title} — ${leg}.` : `Next stop on the journey: ${title}.`),
    lastStop: "This is the last stop of the journey.",
    fromVisitor: (title, leg) => `Distance from the visitor's location to ${title}: ${leg}.`,
    nearVisitorItem: (name, distance, walk) => `${name}: ${distance} (around ${walk} min on foot)`,
    nearVisitor: (items) => `Places nearest to the visitor's location: ${items.join("; ")}.`,
    nearHereItem: (name, distance, walk, drive) => `${name}: ${distance} (around ${walk} min on foot, ${drive} min by car)`,
    nearHere: (items) => `Nearest places from here: ${items.join("; ")}.`,
    opening: (name, text) => `Opening hours (${name}): ${sentence(text)}.`,
    access: (name, text) => `Accessibility (${name}): ${text}.`,
    transportItem: (o) => `${o.mode_ar}${fare(o, "SAR")}${o.note_ar ? ` (${o.note_ar})` : ""}`,
    transport: (name, items) => `Transport to ${name} from the Prophet's Mosque: ${items.join("; ")}.`,
    bestTime: (text) => `Best time to visit: ${sentence(text)}.`,
    fromMosque: (distance) => `Distance from the Prophet's Mosque: ${distance}.`,
    mosque: "The Prophet's Mosque",
    hadith: (ref, grading) => `hadith source: ${ref}${grading ? ` (${grading})` : ""}`,
    level: (level) => `level ${level}`,
    humane: "a humane moment",
    virtue: "a virtue",
    factJoin: "; ",
    noFacts: "(No verified facts yet for this place)",
  },
};

const coords = (p: { lat: number | string | null; lng: number | string | null }): LatLng | null =>
  p.lat != null && p.lng != null ? { lat: Number(p.lat), lng: Number(p.lng) } : null;

function describeOpening(json: Json | null, fallback: string | null, t: Phrases): string {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const o = json as Record<string, Json | undefined>;
    if (o.always === true) return t.openAlways;
    if (Array.isArray(o.daily)) {
      const spans = o.daily
        .filter((s): s is [string, string] => Array.isArray(s) && s.length === 2)
        .map(([a, b]) => `${a}–${b}`);
      if (spans.length) return t.openDaily(spans);
    }
  }
  return stripVerify(fallback) ?? t.openUnknown;
}

function describeAccess(p: GuidePlace, t: Phrases): string {
  const parts: string[] = [];
  if (p.has_stairs === true) parts.push(t.stairs);
  if (p.has_stairs === false) parts.push(t.noStairs);
  if (p.wheelchair_ok === true) parts.push(t.wheelchair);
  if (p.walking_effort) parts.push(t.effort(p.walking_effort));
  if (p.visit_minutes) parts.push(t.visitMinutes(p.visit_minutes));
  return parts.length ? parts.join(t.accessJoin) : t.accessUnknown;
}

/**
 * A place's visitor-facing texts in the page's language. English uses the
 * repo translations; where one is missing or stale the Arabic is kept, so the
 * model still has the fact (it translates it, as it does an unreviewed claim).
 */
type PlaceTexts = { name: string; openStatus: string | null; bestTime: string | null; transport: TransportOption[] };

function placeTexts(p: GuidePlace, lang: Lang): PlaceTexts {
  const arTransport = parseTransportOptions(p.transport_options);
  if (lang === "ar") return { name: p.name_ar, openStatus: p.open_status_ar, bestTime: p.best_time_ar, transport: arTransport };
  const en = localizePlace(p, "en");
  const enTransport = parseTransportOptions(en.transport_options);
  return {
    name: en.name_ar,
    openStatus: en.open_status_ar ?? p.open_status_ar,
    bestTime: en.best_time_ar ?? p.best_time_ar,
    // A partial translation would drop fares: keep the Arabic set unless every option has English.
    transport: enTransport.length === arTransport.length ? enTransport : arTransport,
  };
}

export async function buildGuideContext(req: GuideRequestContext): Promise<GuideContext> {
  const lang: Lang = req.lang === "en" ? "en" : "ar";
  const t = PHRASES[lang];
  const { data: places, error: placesErr } = await db
    .from("places")
    .select("id, slug, name_ar, name_en, lat, lng, transport_options, opening_hours, open_status_ar, has_stairs, wheelchair_ok, walking_effort, visit_minutes, best_time_ar")
    .eq("is_published", true);
  if (placesErr) throw placesErr;
  const all = (places ?? []) as GuidePlace[];
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const byId = new Map(all.map((p) => [p.id, p]));
  const texts = new Map(all.map((p) => [p.id, placeTexts(p, lang)]));
  const nameOf = (p: GuidePlace) => texts.get(p.id)!.name;

  // Resolve where the visitor is, and the journey around them.
  let current: GuidePlace | undefined = req.place ? bySlug.get(req.place) : undefined;
  let currentTitle = current ? nameOf(current) : "";
  let currentPoint: LatLng | null = current ? coords(current) : null;
  let nextStop: { title: string; point: LatLng | null } | null = null;
  const journeyPlaceIds = new Set<string>();
  let includeTopic = false;
  let journeyLine = "";

  if (req.journey) {
    const { data: journey } = await db
      .from("journeys")
      .select("id, title_ar, title_en, journey_stops(sort_order, place_id, title_ar, title_en, lat, lng)")
      .eq("slug", req.journey)
      .maybeSingle();
    if (journey) {
      const stops = [...(journey.journey_stops ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      // Arabic: the stop's own title, else the place name. English: the stop's
      // English title, else the place's English name, else the Arabic title.
      const stopTitle = (s: (typeof stops)[number], p: GuidePlace | undefined, fallback: string) =>
        lang === "en"
          ? s.title_en || (p ? nameOf(p) : null) || s.title_ar || fallback
          : s.title_ar ?? p?.name_ar ?? fallback;
      journeyLine = t.journey((lang === "en" && journey.title_en) || journey.title_ar, stops.length);
      stops.forEach((s) => (s.place_id ? journeyPlaceIds.add(s.place_id) : (includeTopic = true)));
      const idx = req.stop ? stops.findIndex((s) => s.sort_order === req.stop) : -1;
      const here = idx >= 0 ? stops[idx] : undefined;
      if (here) {
        const hp = here.place_id ? byId.get(here.place_id) : undefined;
        current = hp ?? current;
        currentTitle = stopTitle(here, hp, currentTitle);
        currentPoint = coords(here) ?? (hp ? coords(hp) : null) ?? (here.place_id ? null : PROPHETS_MOSQUE);
        const nx = stops[idx + 1];
        if (nx) {
          const np = nx.place_id ? byId.get(nx.place_id) : undefined;
          nextStop = {
            title: stopTitle(nx, np, ""),
            point: coords(nx) ?? (np ? coords(np) : null) ?? (nx.place_id ? null : PROPHETS_MOSQUE),
          };
        }
      }
    }
  }

  // Claims: current place + the journey's places (or the two nearest places).
  const placeIds = new Set<string>(journeyPlaceIds);
  if (current) placeIds.add(current.id);
  if (!req.journey && currentPoint) {
    all
      .filter((p) => p.id !== current?.id && coords(p))
      .map((p) => ({ p, km: haversineKm(currentPoint!, coords(p)!) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 2)
      .forEach(({ p }) => placeIds.add(p.id));
  }
  if (!current && !req.journey) includeTopic = true;

  const claimSelect = "id, place_id, topic, text_ar, text_en, en_reviewed, source_id, vol, page, samarrai_ref, hadith_ref, grading, content_level, kind, quote_ar";
  const [placeClaims, topicClaims, sources] = await Promise.all([
    placeIds.size
      ? db.from("claims").select(claimSelect).eq("status", "verified").in("place_id", [...placeIds]).order("id")
      : Promise.resolve({ data: [] as GuideClaim[], error: null }),
    includeTopic
      ? db.from("claims").select(claimSelect).eq("status", "verified").is("place_id", null).eq("topic", NULL_PLACE_TOPIC).order("id")
      : Promise.resolve({ data: [] as GuideClaim[], error: null }),
    // Book titles for the citation list on English pages (Arabic pages name the book in their message).
    lang === "en"
      ? db.from("sources").select("id, title_en, author_en")
      : Promise.resolve({ data: [] as Pick<Tables<"sources">, "id" | "title_en" | "author_en">[], error: null }),
  ]);
  if (placeClaims.error) throw placeClaims.error;
  if (topicClaims.error) throw topicClaims.error;
  // Only the citation titles depend on it: answer anyway, with the generic book name.
  if (sources.error) console.error("guide sources lookup failed", sources.error.message);
  const claims = [...(placeClaims.data ?? []), ...(topicClaims.data ?? [])] as GuideClaim[];
  const sourceById = new Map((sources.data ?? []).map((s) => [s.id, s]));

  const citations = new Map<number, CitationInfo>();
  const factLines = claims.map((c) => {
    const claimPlace = c.place_id ? byId.get(c.place_id) : undefined;
    const placeName = c.place_id ? (claimPlace ? nameOf(claimPlace) : "") : t.mosque;
    const src = lang === "en" ? sourceById.get(c.source_id) : undefined;
    const title = src?.title_en?.trim();
    citations.set(c.id, {
      id: c.id,
      place: placeName,
      vol: c.vol,
      page: c.page,
      samarrai: c.samarrai_ref,
      hadith: c.hadith_ref,
      grading: c.grading,
      quote: c.quote_ar,
      ...(title ? { source: { title, author: src?.author_en?.trim() || null } } : {}),
    });
    const extra = [
      c.hadith_ref ? t.hadith(c.hadith_ref, c.grading) : "",
      t.level(c.content_level),
      c.kind === "humane" ? t.humane : c.kind === "virtue" ? t.virtue : "",
    ].filter(Boolean);
    const en = c.en_reviewed && c.text_en ? ` | EN: ${c.text_en}` : "";
    return `[C${c.id}] (${placeName}) ${c.text_ar}${en} — ${extra.join(t.factJoin)}`;
  });

  // Practical facts, computed.
  const legLine = (from: LatLng, to: LatLng): string => {
    const km = haversineKm(from, to);
    return t.leg(formatDistance(km, lang), walkMinutes(km), driveMinutes(km));
  };
  const lines: string[] = [];
  if (journeyLine) lines.push(journeyLine);
  if (currentTitle) lines.push(t.here(currentTitle));
  if (nextStop) {
    lines.push(t.nextStop(nextStop.title, nextStop.point && currentPoint ? legLine(currentPoint, nextStop.point) : null));
  } else if (req.journey && req.stop) {
    lines.push(t.lastStop);
  }
  if (req.location) {
    if (currentPoint) lines.push(t.fromVisitor(currentTitle, legLine(req.location, currentPoint)));
    const near = all
      .filter((p) => coords(p))
      .map((p) => ({ p, km: haversineKm(req.location!, coords(p)!) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3)
      .map(({ p, km }) => t.nearVisitorItem(nameOf(p), formatDistance(km, lang), walkMinutes(km)));
    if (near.length) lines.push(t.nearVisitor(near));
  } else if (currentPoint) {
    const near = all
      .filter((p) => p.id !== current?.id && coords(p))
      .map((p) => ({ p, km: haversineKm(currentPoint!, coords(p)!) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3)
      .map(({ p, km }) => t.nearHereItem(nameOf(p), formatDistance(km, lang), walkMinutes(km), driveMinutes(km)));
    if (near.length) lines.push(t.nearHere(near));
  }
  for (const p of current ? [current] : []) {
    const pt = texts.get(p.id)!;
    lines.push(t.opening(pt.name, describeOpening(p.opening_hours, pt.openStatus, t)));
    lines.push(t.access(pt.name, describeAccess(p, t)));
    const transport = pt.transport.map(t.transportItem);
    if (transport.length) lines.push(t.transport(pt.name, transport));
    const best = stripVerify(pt.bestTime);
    if (best) lines.push(t.bestTime(best));
  }
  if (currentPoint) lines.push(t.fromMosque(formatDistance(haversineKm(PROPHETS_MOSQUE, currentPoint), lang)));

  const where = req.journey ? `${req.journey}#${req.stop ?? 0}` : req.place ?? "general";
  return {
    // English pages are tagged so the logs show guide use per language.
    label: lang === "en" ? `en:${where}` : where,
    factsBlock: factLines.length ? factLines.join("\n") : t.noFacts,
    practicalBlock: lines.join("\n"),
    claims: citations,
  };
}

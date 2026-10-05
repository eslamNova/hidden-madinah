import { createClient } from "@supabase/supabase-js";
import type { Database, Json, Tables } from "@/lib/database.types";
import { parseTransportOptions, stripVerify } from "@/lib/content";
import { PROPHETS_MOSQUE, driveMinutes, formatDistance, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";

/**
 * Builds everything the guide may say, in code, before the model sees it:
 *   - verified claims (the only allowed source for history/religion), tagged [C<id>]
 *   - practical facts computed here (distances, times, transport, opening, access)
 * The model never computes a distance or recalls a fact from memory.
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
  "id" | "place_id" | "topic" | "text_ar" | "text_en" | "en_reviewed" | "vol" | "page" | "samarrai_ref" | "hadith_ref" | "grading" | "content_level" | "kind" | "quote_ar"
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
};

export type GuideContext = {
  label: string;                       // where the visitor is (for logs)
  factsBlock: string;                  // [C] claims, one per line
  practicalBlock: string;              // computed practical facts
  claims: Map<number, CitationInfo>;   // allowed citation ids
};

const coords = (p: { lat: number | string | null; lng: number | string | null }): LatLng | null =>
  p.lat != null && p.lng != null ? { lat: Number(p.lat), lng: Number(p.lng) } : null;

function describeOpening(json: Json | null, fallback: string | null): string {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const o = json as Record<string, Json | undefined>;
    if (o.always === true) return "مفتوح على مدار اليوم";
    if (Array.isArray(o.daily)) {
      const spans = o.daily
        .filter((s): s is [string, string] => Array.isArray(s) && s.length === 2)
        .map(([a, b]) => `${a}–${b}`);
      if (spans.length) return `يوميًا ${spans.join("، ")}`;
    }
  }
  return stripVerify(fallback) ?? "غير متوفرة لدينا — قل ذلك صراحة إن سُئلت";
}

function describeAccess(p: GuidePlace): string {
  const parts: string[] = [];
  if (p.has_stairs === true) parts.push("فيه درج");
  if (p.has_stairs === false) parts.push("بلا درج");
  if (p.wheelchair_ok === true) parts.push("مناسب للكراسي المتحركة");
  if (p.walking_effort) parts.push(`جهد المشي: ${{ low: "قليل", medium: "متوسط", high: "مرتفع" }[p.walking_effort] ?? p.walking_effort}`);
  if (p.visit_minutes) parts.push(`مدة الزيارة المقترحة: ${p.visit_minutes} دقيقة`);
  return parts.length ? parts.join("، ") : "معلومات سهولة الوصول غير متوفرة لدينا";
}

function legLine(from: LatLng, to: LatLng): string {
  const km = haversineKm(from, to);
  return `${formatDistance(km)} تقريبًا (نحو ${walkMinutes(km)} دقيقة مشيًا، أو ${driveMinutes(km)} دقائق بالسيارة)`;
}

export async function buildGuideContext(req: GuideRequestContext): Promise<GuideContext> {
  const { data: places, error: placesErr } = await db
    .from("places")
    .select("id, slug, name_ar, name_en, lat, lng, transport_options, opening_hours, open_status_ar, has_stairs, wheelchair_ok, walking_effort, visit_minutes, best_time_ar")
    .eq("is_published", true);
  if (placesErr) throw placesErr;
  const all = (places ?? []) as GuidePlace[];
  const bySlug = new Map(all.map((p) => [p.slug, p]));
  const byId = new Map(all.map((p) => [p.id, p]));

  // Resolve where the visitor is, and the journey around them.
  let current: GuidePlace | undefined = req.place ? bySlug.get(req.place) : undefined;
  let currentTitle = current?.name_ar ?? "";
  let currentPoint: LatLng | null = current ? coords(current) : null;
  let nextStop: { title: string; point: LatLng | null } | null = null;
  const journeyPlaceIds = new Set<string>();
  let includeTopic = false;
  let journeyLine = "";

  if (req.journey) {
    const { data: journey } = await db
      .from("journeys")
      .select("id, title_ar, journey_stops(sort_order, place_id, title_ar, lat, lng)")
      .eq("slug", req.journey)
      .maybeSingle();
    if (journey) {
      const stops = [...(journey.journey_stops ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      journeyLine = `الرحلة: «${journey.title_ar}» (${stops.length} محطات).`;
      stops.forEach((s) => (s.place_id ? journeyPlaceIds.add(s.place_id) : (includeTopic = true)));
      const idx = req.stop ? stops.findIndex((s) => s.sort_order === req.stop) : -1;
      const here = idx >= 0 ? stops[idx] : undefined;
      if (here) {
        const hp = here.place_id ? byId.get(here.place_id) : undefined;
        current = hp ?? current;
        currentTitle = here.title_ar ?? hp?.name_ar ?? currentTitle;
        currentPoint = coords(here) ?? (hp ? coords(hp) : null) ?? (here.place_id ? null : PROPHETS_MOSQUE);
        const nx = stops[idx + 1];
        if (nx) {
          const np = nx.place_id ? byId.get(nx.place_id) : undefined;
          nextStop = {
            title: nx.title_ar ?? np?.name_ar ?? "",
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

  const claimSelect = "id, place_id, topic, text_ar, text_en, en_reviewed, vol, page, samarrai_ref, hadith_ref, grading, content_level, kind, quote_ar";
  const [placeClaims, topicClaims] = await Promise.all([
    placeIds.size
      ? db.from("claims").select(claimSelect).eq("status", "verified").in("place_id", [...placeIds]).order("id")
      : Promise.resolve({ data: [] as GuideClaim[], error: null }),
    includeTopic
      ? db.from("claims").select(claimSelect).eq("status", "verified").is("place_id", null).eq("topic", NULL_PLACE_TOPIC).order("id")
      : Promise.resolve({ data: [] as GuideClaim[], error: null }),
  ]);
  if (placeClaims.error) throw placeClaims.error;
  if (topicClaims.error) throw topicClaims.error;
  const claims = [...(placeClaims.data ?? []), ...(topicClaims.data ?? [])] as GuideClaim[];

  const citations = new Map<number, CitationInfo>();
  const factLines = claims.map((c) => {
    const placeName = c.place_id ? byId.get(c.place_id)?.name_ar ?? "" : "المسجد النبوي";
    citations.set(c.id, {
      id: c.id,
      place: placeName,
      vol: c.vol,
      page: c.page,
      samarrai: c.samarrai_ref,
      hadith: c.hadith_ref,
      grading: c.grading,
      quote: c.quote_ar,
    });
    const extra = [
      c.hadith_ref ? `التخريج: ${c.hadith_ref}${c.grading ? ` (${c.grading})` : ""}` : "",
      `المستوى ${c.content_level}`,
      c.kind === "humane" ? "موقف إنساني" : c.kind === "virtue" ? "فضل" : "",
    ].filter(Boolean);
    const en = c.en_reviewed && c.text_en ? ` | EN: ${c.text_en}` : "";
    return `[C${c.id}] (${placeName}) ${c.text_ar}${en} — ${extra.join("؛ ")}`;
  });

  // Practical facts, computed.
  const lines: string[] = [];
  if (journeyLine) lines.push(journeyLine);
  if (currentTitle) lines.push(`الزائر الآن عند: ${currentTitle}.`);
  if (nextStop) {
    lines.push(
      nextStop.point && currentPoint
        ? `المحطة التالية في الرحلة: ${nextStop.title} — ${legLine(currentPoint, nextStop.point)}.`
        : `المحطة التالية في الرحلة: ${nextStop.title}.`
    );
  } else if (req.journey && req.stop) {
    lines.push("هذه آخر محطة في الرحلة.");
  }
  if (req.location) {
    if (currentPoint) lines.push(`المسافة من موقع الزائر إلى ${currentTitle}: ${legLine(req.location, currentPoint)}.`);
    const near = all
      .filter((p) => coords(p))
      .map((p) => ({ p, km: haversineKm(req.location!, coords(p)!) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3)
      .map(({ p, km }) => `${p.name_ar}: ${formatDistance(km)} (نحو ${walkMinutes(km)} دقيقة مشيًا)`);
    if (near.length) lines.push(`أقرب المواضع إلى موقع الزائر: ${near.join("؛ ")}.`);
  } else if (currentPoint) {
    const near = all
      .filter((p) => p.id !== current?.id && coords(p))
      .map((p) => ({ p, km: haversineKm(currentPoint!, coords(p)!) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3)
      .map(({ p, km }) => `${p.name_ar}: ${formatDistance(km)} (نحو ${walkMinutes(km)} دقيقة مشيًا، ${driveMinutes(km)} بالسيارة)`);
    if (near.length) lines.push(`أقرب المواضع من هنا: ${near.join("؛ ")}.`);
  }
  for (const p of current ? [current] : []) {
    lines.push(`أوقات الفتح (${p.name_ar}): ${describeOpening(p.opening_hours, p.open_status_ar)}.`);
    lines.push(`سهولة الوصول (${p.name_ar}): ${describeAccess(p)}.`);
    const transport = parseTransportOptions(p.transport_options)
      .map((o) => `${o.mode_ar}${o.min_sar != null ? ` ${o.min_sar}${o.max_sar != null ? `–${o.max_sar}` : ""} ريال` : ""}${o.note_ar ? ` (${o.note_ar})` : ""}`)
      .join("؛ ");
    if (transport) lines.push(`المواصلات إلى ${p.name_ar} من المسجد النبوي: ${transport}.`);
    if (p.best_time_ar && stripVerify(p.best_time_ar)) lines.push(`أفضل وقت للزيارة: ${stripVerify(p.best_time_ar)}.`);
  }
  if (currentPoint) lines.push(`المسافة من المسجد النبوي: ${formatDistance(haversineKm(PROPHETS_MOSQUE, currentPoint))}.`);

  return {
    label: req.journey ? `${req.journey}#${req.stop ?? 0}` : req.place ?? "general",
    factsBlock: factLines.length ? factLines.join("\n") : "(لا توجد معلومات معتمدة بعد لهذا الموضع)",
    practicalBlock: lines.join("\n"),
    claims: citations,
  };
}

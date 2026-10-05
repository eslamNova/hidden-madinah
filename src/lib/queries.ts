import { createClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";

/**
 * Cookie-less anon client for public reads (safe during SSG/ISR where
 * next/headers is unavailable). RLS restricts anon to published content.
 */
const publicClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export type PlaceRow = Tables<"places">;
export type MediaRow = Tables<"media">;
export type RouteRow = Tables<"routes">;
export type PlaceWithMedia = PlaceRow & { media: MediaRow[] };
export type RouteWithStops = RouteRow & { stops: PlaceWithMedia[] };

function sortMedia<T extends { media: MediaRow[] | null }>(place: T): T & { media: MediaRow[] } {
  return {
    ...place,
    media: [...(place.media ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function getPublishedPlaces(): Promise<PlaceWithMedia[]> {
  const { data, error } = await publicClient
    .from("places")
    .select("*, media(*)")
    .eq("is_published", true)
    .order("featured", { ascending: false })
    .order("distance_from_prophets_mosque_km", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(sortMedia);
}

export async function getFeaturedPlaces(limit = 4): Promise<PlaceWithMedia[]> {
  const { data, error } = await publicClient
    .from("places")
    .select("*, media(*)")
    .eq("is_published", true)
    .eq("featured", true)
    .order("distance_from_prophets_mosque_km", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(sortMedia);
}

export async function getPlaceBySlug(slug: string): Promise<PlaceWithMedia | null> {
  const { data, error } = await publicClient
    .from("places")
    .select("*, media(*)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return data ? sortMedia(data) : null;
}

export async function getPublishedSlugs(): Promise<string[]> {
  const { data, error } = await publicClient
    .from("places")
    .select("slug")
    .eq("is_published", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.slug);
}

/** Published places among the given slugs, in the order the slugs are listed. */
export async function getPlacesBySlugs(slugs: string[]): Promise<PlaceWithMedia[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await publicClient
    .from("places")
    .select("*, media(*)")
    .eq("is_published", true)
    .in("slug", slugs);
  if (error) throw error;
  const bySlug = new Map((data ?? []).map((p) => [p.slug, sortMedia(p)]));
  return slugs.flatMap((s) => {
    const p = bySlug.get(s);
    return p ? [p] : [];
  });
}

export async function getRoutes(): Promise<RouteRow[]> {
  const { data, error } = await publicClient.from("routes").select("*").order("title_ar");
  if (error) throw error;
  return data ?? [];
}

/**
 * All routes with their stops in ONE round trip — used by the home and routes
 * pages, which previously issued a query per route.
 */
export async function getRoutesWithStops(): Promise<RouteWithStops[]> {
  const { data, error } = await publicClient
    .from("routes")
    .select("*, route_places(sort_order, places(*, media(*)))")
    .order("title_ar");
  if (error) throw error;
  return (data ?? []).map(({ route_places, ...route }) => ({
    ...route,
    stops: (route_places ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((rp) => (rp.places && rp.places.is_published ? [sortMedia(rp.places)] : [])),
  }));
}

export async function getRouteWithStops(slug: string): Promise<RouteWithStops | null> {
  const { data, error } = await publicClient
    .from("routes")
    .select("*, route_places(sort_order, places(*, media(*)))")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { route_places, ...route } = data;
  const stops = (route_places ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((rp) => (rp.places && rp.places.is_published ? [sortMedia(rp.places)] : []));
  return { ...route, stops };
}

/** Old /routes/<uuid> links redirect: id → slug (null when the id is unknown). */
export async function getRouteSlugById(id: string): Promise<string | null> {
  const { data, error } = await publicClient
    .from("routes")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.slug ?? null;
}

export async function getRouteSlugs(): Promise<string[]> {
  const { data, error } = await publicClient.from("routes").select("slug");
  if (error) throw error;
  return (data ?? []).map((r) => r.slug);
}

// ── Journeys ────────────────────────────────────────────────────────────────

export type JourneyRow = Tables<"journeys">;
export type JourneyStopRow = Tables<"journey_stops">;
/** Visitors' column grant on claims (migration 008) — reviewer_note is internal. */
const PUBLIC_CLAIM_COLUMNS =
  "id, place_id, topic, text_ar, text_en, en_reviewed, source_id, vol, page, quote_ar, hadith_ref, grading, samarrai_ref, needs_samarrai_check, content_level, kind, themes, status, reviewed_at, created_at";
export type ClaimRow = Omit<Tables<"claims">, "reviewer_note">;
export type JourneyStopFull = JourneyStopRow & { place: PlaceWithMedia | null };
export type JourneyFull = JourneyRow & {
  stops: JourneyStopFull[];
  quiz: Tables<"quiz_items">[];
  claims: Map<number, ClaimRow>;
};

type SupabaseLike = typeof publicClient;

/**
 * Journeys tolerate a missing table (fresh environments before migration 006)
 * so the build never fails on them; every other error still throws.
 */
const isMissingTable = (err: { code?: string; message?: string } | null) =>
  !!err && (err.code === "42P01" || err.code === "PGRST205" || /does not exist|Could not find the table/i.test(err.message ?? ""));

export async function getPublishedJourneys(): Promise<(JourneyRow & { stops: JourneyStopFull[] })[]> {
  const { data, error } = await publicClient
    .from("journeys")
    .select("*, journey_stops(*, places(*, media(*)))")
    .eq("is_published", true)
    .order("sort_order");
  if (isMissingTable(error)) return [];
  if (error) throw error;
  return (data ?? [])
    .map(({ journey_stops, ...j }) => ({
      ...j,
      stops: [...(journey_stops ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ places, ...s }) => ({ ...s, place: places && places.is_published ? sortMedia(places) : null })),
    }))
    // RLS hides unreviewed stops; a journey with none visible isn't ready.
    .filter((j) => j.stops.length > 0);
}

export async function getJourneySlugs(): Promise<string[]> {
  const { data, error } = await publicClient.from("journeys").select("slug").eq("is_published", true);
  if (isMissingTable(error)) return [];
  if (error) throw error;
  return (data ?? []).map((r) => r.slug);
}

/** One journey with stops, places, quiz and every claim its stops cite. */
export async function getJourney(slug: string, client: SupabaseLike = publicClient): Promise<JourneyFull | null> {
  const { data, error } = await client
    .from("journeys")
    .select("*, journey_stops(*, places(*, media(*))), quiz_items(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (isMissingTable(error)) return null;
  if (error) throw error;
  if (!data) return null;
  const { journey_stops, quiz_items, ...journey } = data;
  const stops = [...(journey_stops ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ places, ...s }) => ({ ...s, place: places ? sortMedia(places) : null }));
  // Stop citations plus quiz explanations (a quiz may explain with a claim
  // whose stop is hidden from this reader).
  const ids = [
    ...new Set([
      ...stops.flatMap((s) => s.claim_ids ?? []),
      ...(quiz_items ?? []).flatMap((q) => (q.explanation_claim_id != null ? [q.explanation_claim_id] : [])),
    ]),
  ];
  const claims = new Map<number, ClaimRow>();
  if (ids.length) {
    const { data: rows, error: claimsErr } = await client.from("claims").select(PUBLIC_CLAIM_COLUMNS).in("id", ids);
    if (claimsErr) throw claimsErr;
    for (const c of rows ?? []) claims.set(c.id, c);
  }
  return {
    ...journey,
    stops,
    quiz: [...(quiz_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    claims,
  };
}

// ── Trip planner ────────────────────────────────────────────────────────────

/**
 * Published places with the practical fields the planner needs, plus one
 * verified, cited fact each (a human moment or virtue first, level A first,
 * then the shortest) — the planner shows sources, never generated text.
 */
export async function getPlannerPlaces(): Promise<import("@/lib/planner/solver").PlannerPlace[]> {
  const { data: places, error } = await publicClient
    .from("places")
    .select("id, slug, name_ar, category, lat, lng, featured, visit_minutes, has_stairs, walking_effort")
    .eq("is_published", true);
  if (error) throw error;
  const { data: claims, error: claimsErr } = await publicClient
    .from("claims")
    .select("place_id, text_ar, vol, page, kind, content_level")
    .eq("status", "verified")
    .not("place_id", "is", null);
  if (claimsErr && !isMissingTable(claimsErr)) throw claimsErr;

  const rank = (c: { kind: string; content_level: string; text_ar: string }) =>
    (c.kind === "humane" ? 0 : c.kind === "virtue" ? 1 : 2) * 10 + (c.content_level === "A" ? 0 : 5) + c.text_ar.length / 1000;
  const best = new Map<string, { text_ar: string; vol: number | null; page: number | null; score: number }>();
  for (const c of claims ?? []) {
    if (!c.place_id) continue;
    const score = rank(c);
    const prev = best.get(c.place_id);
    if (!prev || score < prev.score) best.set(c.place_id, { text_ar: c.text_ar, vol: c.vol, page: c.page, score });
  }

  return (places ?? [])
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => {
      const fact = best.get(p.id);
      return {
        slug: p.slug,
        name: p.name_ar,
        category: p.category,
        lat: Number(p.lat),
        lng: Number(p.lng),
        featured: p.featured,
        visitMinutes: p.visit_minutes,
        hasStairs: p.has_stairs,
        walkingEffort: (p.walking_effort as "low" | "medium" | "high" | null) ?? null,
        fact: fact ? { text: fact.text_ar, vol: fact.vol, page: fact.page } : null,
      };
    });
}

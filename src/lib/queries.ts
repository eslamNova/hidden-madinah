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

import type { Json, Tables } from "@/lib/database.types";

const VERIFY_RE = /\[VERIFY[^\]]*\]/g;

/**
 * Owner content may carry inline [VERIFY: ...] markers (facts awaiting the
 * owner's confirmation). Public pages must never render them: this strips the
 * markers and returns null when nothing meaningful remains, so callers hide
 * the whole row (e.g. Quba's best_time_ar until the owner fills it in).
 */
export function stripVerify(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.replace(VERIFY_RE, "").replace(/[ \t]{2,}/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function hasVerifyMarker(text: string | null | undefined): boolean {
  return !!text && text.includes("[VERIFY");
}

const REVIEWABLE_FIELDS = [
  "summary_ar",
  "story_ar",
  "virtue_ar",
  "how_to_get_there_ar",
  "transport_note_ar",
  "best_time_ar",
  "open_status_ar",
  "visiting_tips_ar",
  "featured_quote_ar",
  "featured_quote_source_ar",
] as const satisfies readonly (keyof Tables<"places">)[];

export type ReviewableField = (typeof REVIEWABLE_FIELDS)[number];

/** Fields of a place that currently carry [VERIFY] markers. */
export function verifyFlaggedFields(
  place: Partial<Tables<"places">>
): ReviewableField[] {
  return REVIEWABLE_FIELDS.filter((f) => hasVerifyMarker(place[f] as string | null));
}

/**
 * Drives the "يحتاج مراجعة" badge in /admin: true when any text field carries
 * a [VERIFY] marker or the place has owner-facing review notes.
 */
export function hasVerifyFlags(place: Partial<Tables<"places">>): boolean {
  return verifyFlaggedFields(place).length > 0 || !!place.admin_notes_ar?.trim();
}

/**
 * Everything a public page may show about a place — [VERIFY] markers already
 * stripped, owner-only columns (admin_notes_ar) dropped. Building this at the
 * page boundary keeps raw rows out of the RSC payload entirely, so unconfirmed
 * facts cannot leak even through a client component's props.
 */
export type PublicPlaceView = {
  slug: string;
  name_ar: string;
  category: Tables<"places">["category"];
  featured: boolean;
  summary: string | null;
  story: string | null;
  virtue: string | null;
  tips: string | null;
  quote: string | null;
  quoteSource: string | null;
  howToGet: string | null;
  transportOptions: TransportOption[];
  transportNote: string | null;
  bestTime: string | null;
  openStatus: string | null;
  distanceKm: number | null;
  driveTimeMin: number | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  relatedSlugs: string[];
  lastUpdated: string;
};

export function toPublicPlaceView(
  place: Tables<"places">,
  mapsUrl: string | null
): PublicPlaceView {
  return {
    slug: place.slug,
    name_ar: place.name_ar,
    category: place.category,
    featured: place.featured,
    summary: stripVerify(place.summary_ar),
    story: stripVerify(place.story_ar),
    virtue: stripVerify(place.virtue_ar),
    tips: stripVerify(place.visiting_tips_ar),
    quote: stripVerify(place.featured_quote_ar),
    quoteSource: stripVerify(place.featured_quote_source_ar),
    howToGet: stripVerify(place.how_to_get_there_ar),
    transportOptions: parseTransportOptions(place.transport_options),
    transportNote: stripVerify(place.transport_note_ar),
    bestTime: stripVerify(place.best_time_ar),
    openStatus: stripVerify(place.open_status_ar),
    distanceKm:
      place.distance_from_prophets_mosque_km != null
        ? Number(place.distance_from_prophets_mosque_km)
        : null,
    driveTimeMin: place.drive_time_from_haram_min,
    lat: place.lat != null ? Number(place.lat) : null,
    lng: place.lng != null ? Number(place.lng) : null,
    mapsUrl,
    relatedSlugs: place.related_place_slugs,
    lastUpdated: place.last_updated,
  };
}

export type TransportOption = {
  mode_ar: string;
  min_sar?: number;
  max_sar?: number;
  note_ar?: string;
};

/** Safely parse the transport_options jsonb column into typed rows. */
export function parseTransportOptions(json: Json | null | undefined): TransportOption[] {
  if (!Array.isArray(json)) return [];
  const rows: TransportOption[] = [];
  for (const item of json) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, Json | undefined>;
      if (typeof o.mode_ar === "string" && o.mode_ar.trim()) {
        rows.push({
          mode_ar: o.mode_ar,
          min_sar: typeof o.min_sar === "number" ? o.min_sar : undefined,
          max_sar: typeof o.max_sar === "number" ? o.max_sar : undefined,
          note_ar: typeof o.note_ar === "string" ? o.note_ar : undefined,
        });
      }
    }
  }
  return rows;
}

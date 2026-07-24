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

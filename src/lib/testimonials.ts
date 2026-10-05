import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Lang } from "@/lib/i18n";

/**
 * Visitor testimonials («آراء الزوار»). Visitors write them at the end of a
 * journey (TestimonialForm); nothing is public until an admin approves it at
 * /admin/testimonials. RLS: anon may insert only with consent = true and
 * status = 'pending', and reads only status = 'verified'.
 */

/**
 * The testimonials_sizes CHECK in supabase/migrations/008_hardening.sql —
 * the form enforces the same limits so the database never has to refuse.
 */
export const TESTIMONIAL_LIMITS = { bodyMin: 10, bodyMax: 1000, nameMax: 80 } as const;

/** Postgres char_length counts code points; JS .length counts UTF-16 units (an emoji is 2). */
export const charLength = (s: string) => [...s].length;

/** What the public site shows: never the consent flag, status or journey. */
export type Testimonial = {
  id: number;
  name: string | null;
  body: string;
  /** Language the visitor wrote in (the journey page's language); null when unknown. */
  lang: Lang | null;
};

const asLang = (v: string | null): Lang | null => (v === "ar" || v === "en" ? v : v?.startsWith("en") ? "en" : v?.startsWith("ar") ? "ar" : null);

/**
 * Up to `limit` latest approved testimonials, every language included. With
 * `lang`, the ones written in that language come first (each group newest
 * first), so an English visitor reads English before Arabic.
 *
 * Never throws: the home page must render without them (missing table, network).
 * Cookie-less anon client, created per call — this module is also imported by
 * the client form for its limits, which must not open a second client there.
 */
export async function getVerifiedTestimonials(lang?: Lang, limit = 6): Promise<Testimonial[]> {
  try {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, display_name, body, lang")
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(limit * 4);
    if (error || !data) return [];
    const rows: Testimonial[] = data
      .map((r) => ({ id: r.id, name: r.display_name?.trim() || null, body: r.body.trim(), lang: asLang(r.lang) }))
      .filter((r) => r.body.length > 0);
    const ordered = lang ? [...rows.filter((r) => r.lang === lang), ...rows.filter((r) => r.lang !== lang)] : rows;
    return ordered.slice(0, limit);
  } catch {
    return [];
  }
}

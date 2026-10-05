import { coverImage, parseTransportOptions, stripVerify, type CoverImage, type TransportOption } from "@/lib/content";
import { PROPHETS_MOSQUE, driveMinutes, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";
import type { JourneyFull } from "@/lib/queries";

/**
 * Serializable, language-resolved view of a journey for the client player.
 * Everything that can be computed (legs, access notes) is computed here, on
 * the server, so the player only renders.
 */

export type Lang = "ar" | "en";

export type StopSource = {
  id: number;
  text: string;
  vol: number | null;
  page: number | null;
  samarrai: string | null;
  hadith: string | null;
  grading: string | null;
};

export type PlayerStop = {
  /** Position shown to the visitor (1…n), independent of hidden stops. */
  index: number;
  /** Database sort_order — what the guide API uses to find the stop. */
  order: number;
  title: string;
  placeSlug: string | null;
  cover: CoverImage | null;
  script: string;
  scriptKids: string | null;
  humanMoment: string | null;
  reflection: string | null;
  sources: StopSource[];
  point: LatLng | null;
  next: { title: string; km: number; walkMin: number; driveMin: number } | null;
  hasStairs: boolean | null;
  walkingEffort: string | null;
  visitMin: number | null;
  transport: TransportOption[];
};

export type PlayerQuiz = { question: string; options: string[]; answer: number; explanation: string | null };

export type PlayerJourney = {
  slug: string;
  lang: Lang;
  title: string;
  subtitle: string | null;
  intro: string | null;
  theme: string | null;
  durationMin: number | null;
  mode: string | null;
  cover: CoverImage | null;
  stops: PlayerStop[];
  quiz: PlayerQuiz[];
};

const pick = (lang: Lang, ar: string | null | undefined, en: string | null | undefined) =>
  (lang === "en" ? en || null : ar || null) ?? null;

export function toPlayerJourney(j: JourneyFull, lang: Lang = "ar"): PlayerJourney {
  const points: (LatLng | null)[] = j.stops.map((s) => {
    if (s.lat != null && s.lng != null) return { lat: Number(s.lat), lng: Number(s.lng) };
    if (s.place?.lat != null && s.place?.lng != null) return { lat: Number(s.place.lat), lng: Number(s.place.lng) };
    return s.place_id ? null : PROPHETS_MOSQUE;
  });
  const titles = j.stops.map((s) =>
    lang === "en"
      ? s.title_en ?? s.place?.name_en ?? s.title_ar ?? s.place?.name_ar ?? ""
      : s.title_ar ?? s.place?.name_ar ?? ""
  );

  const stops: PlayerStop[] = j.stops.map((s, i) => {
    const here = points[i];
    const nextPoint = points[i + 1];
    let next: PlayerStop["next"] = null;
    if (i + 1 < j.stops.length) {
      const km = here && nextPoint ? haversineKm(here, nextPoint) : 0;
      next = { title: titles[i + 1], km, walkMin: walkMinutes(km), driveMin: driveMinutes(km) };
    }
    const sources: StopSource[] = (s.claim_ids ?? [])
      .map((id) => j.claims.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({
        id: c.id,
        text: (lang === "en" && c.en_reviewed && c.text_en) || c.text_ar,
        vol: c.vol,
        page: c.page,
        samarrai: c.samarrai_ref,
        hadith: c.hadith_ref,
        grading: c.grading,
      }));
    return {
      index: i + 1,
      order: s.sort_order,
      title: titles[i],
      placeSlug: s.place?.slug ?? null,
      cover: s.place ? coverImage(s.place.media) : null,
      script: pick(lang, s.script_ar, s.script_en) ?? "",
      scriptKids: lang === "ar" ? s.script_kids_ar : null,
      humanMoment: pick(lang, s.human_moment_ar, s.human_moment_en),
      reflection: pick(lang, s.reflection_ar, s.reflection_en),
      sources,
      point: here,
      next,
      hasStairs: s.place?.has_stairs ?? null,
      walkingEffort: s.place?.walking_effort ?? null,
      visitMin: s.place?.visit_minutes ?? null,
      transport: s.place ? parseTransportOptions(s.place.transport_options) : [],
    };
  });

  const claimText = (id: number | null) => {
    const c = id != null ? j.claims.get(id) : undefined;
    if (!c) return null;
    return (lang === "en" && c.en_reviewed && c.text_en) || c.text_ar;
  };

  return {
    slug: j.slug,
    lang,
    title: pick(lang, j.title_ar, j.title_en) ?? j.title_ar,
    subtitle: stripVerify(pick(lang, j.subtitle_ar, j.subtitle_en)),
    intro: pick(lang, j.intro_ar, j.intro_en),
    theme: pick(lang, j.theme_ar, j.theme_en),
    durationMin: j.duration_min,
    mode: j.mode,
    cover: stops.find((s) => s.cover)?.cover ?? null,
    stops,
    quiz: j.quiz
      .map((q) => ({
        question: pick(lang, q.question_ar, q.question_en) ?? q.question_ar,
        options: (lang === "en" && q.options_en?.length === 4 ? q.options_en : q.options_ar) ?? [],
        answer: q.answer_index,
        explanation: claimText(q.explanation_claim_id),
      }))
      .filter((q) => q.options.length >= 2),
  };
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Car, CheckCircle2, Footprints, Heart, MapPinned, MessageCircleQuestion, TriangleAlert } from "lucide-react";
import type { PlayerStop } from "@/lib/journey-view";
import { formatDistance } from "@/lib/geo";
import { addVisit, readVisits, VISITS_EVENT } from "@/lib/visits";
import { PlaceImage } from "@/components/place/PlaceImage";
import { GuideChat } from "@/components/guide/GuideChat";
import { NarrationPlayer } from "./NarrationPlayer";

export function StopView({
  stop,
  total,
  journeySlug,
  lang,
  preview = false,
  kids,
  onKidsChange,
}: {
  stop: PlayerStop;
  total: number;
  journeySlug: string;
  lang: "ar" | "en";
  /** Reviewer preview: check-ins stay in memory, never on the device. */
  preview?: boolean;
  kids: boolean;
  onKidsChange: (kids: boolean) => void;
}) {
  const t = useTranslations("journey");
  const [here, setHere] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    if (preview) return;
    const sync = () => setHere(!!stop.placeSlug && readVisits().some((v) => v.slug === stop.placeSlug));
    sync();
    window.addEventListener(VISITS_EVENT, sync);
    return () => window.removeEventListener(VISITS_EVENT, sync);
  }, [stop.placeSlug, preview]);

  const script = kids && stop.scriptKids ? stop.scriptKids : stop.script;
  const access = [
    stop.hasStairs === true && { key: "stairs", warn: true, text: t("hasStairs") },
    stop.hasStairs === false && { key: "nostairs", warn: false, text: t("noStairs") },
    stop.walkingEffort && { key: "effort", warn: stop.walkingEffort === "high", text: t(`effort.${stop.walkingEffort}`) },
    stop.visitMin && { key: "visit", warn: false, text: t("visitMinutes", { min: stop.visitMin }) },
  ].filter((x): x is { key: string; warn: boolean; text: string } => !!x);

  return (
    <article className="space-y-5" aria-labelledby={`stop-${stop.index}`}>
      <header className="space-y-1">
        <p className="font-semibold text-brand">{t("stopOf", { n: stop.index, total })}</p>
        {/* Focus target after every step change (JourneyPlayer). */}
        <h2 id={`stop-${stop.index}`} tabIndex={-1} data-step-heading className="text-2xl leading-snug outline-none">
          {stop.title}
        </h2>
      </header>

      {stop.cover && (
        <div className="overflow-hidden rounded-3xl">
          <PlaceImage media={stop.cover} alt={stop.title} sizes="(min-width: 768px) 720px, 100vw" className="aspect-[16/10] w-full object-cover" />
        </div>
      )}

      <NarrationPlayer text={script} lang={lang} />

      {stop.scriptKids && (
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" checked={kids} onChange={(e) => onKidsChange(e.target.checked)} className="h-5 w-5" />
          {t("kidsVersion")}
        </label>
      )}

      <p className="whitespace-pre-line text-lg leading-loose">{script}</p>

      {stop.humanMoment && (
        <aside className="flex gap-3 rounded-2xl border-[1.5px] border-accent/60 bg-sand/60 p-4">
          <Heart aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h3 className="font-semibold">{t("humanMoment")}</h3>
            <p className="leading-relaxed">{stop.humanMoment}</p>
          </div>
        </aside>
      )}

      {stop.sources.length > 0 && (
        <details className="rounded-2xl border border-ink/10 bg-surface p-4">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
            <BookOpen aria-hidden="true" className="h-5 w-5" />
            {t("sourcesCount", { count: stop.sources.length })}
          </summary>
          <ol className="mt-3 space-y-3 text-sm">
            {stop.sources.map((s, i) => (
              <li key={s.id} className="leading-relaxed">
                <span className="font-bold ltr-nums">[{i + 1}]</span> {s.text}
                <span className="block text-muted">
                  {t("sourceRef", { vol: s.vol ?? "?", page: s.page ?? "?" })}
                  {s.samarrai && ` · ${t("samarraiRef", { ref: s.samarrai })}`}
                  {s.hadith && ` · ${s.hadith}${s.grading ? ` (${s.grading})` : ""}`}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {stop.placeSlug && (
        <button
          type="button"
          disabled={here}
          onClick={() => {
            if (preview) setHere(true);
            else addVisit(stop.placeSlug!, "journey");
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-primary px-5 text-lg font-semibold text-brand disabled:border-transparent disabled:bg-primary/10"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          {here ? t("checkedIn") : t("checkIn")}
        </button>
      )}

      {access.length > 0 && (
        <ul className="space-y-1 text-muted">
          {access.map((a) => (
            <li key={a.key} className="flex items-center gap-2">
              {a.warn && <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />}
              {a.text}
            </li>
          ))}
        </ul>
      )}

      {stop.reflection && (
        <blockquote className="border-s-4 border-primary ps-4 text-lg italic leading-relaxed">
          <span className="block text-sm font-semibold not-italic text-brand">{t("reflect")}</span>
          {stop.reflection}
        </blockquote>
      )}

      {stop.next && (
        <section className="space-y-2 rounded-2xl bg-surface p-4 shadow-sm" aria-label={t("nextStop")}>
          <h3 className="flex items-center gap-2 font-semibold">
            <MapPinned aria-hidden="true" className="h-5 w-5" />
            {t("nextIs", { title: stop.next.title })}
          </h3>
          {stop.next.km > 0 && (
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <Footprints aria-hidden="true" className="h-4 w-4" />
                <span>{t("walkLeg", { distance: formatDistance(stop.next.km, lang), min: stop.next.walkMin })}</span>
              </span>
              <span className="flex items-center gap-1">
                <Car aria-hidden="true" className="h-4 w-4" />
                <span>{t("driveLeg", { min: stop.next.driveMin })}</span>
              </span>
            </p>
          )}
          {stop.next.km > 1.5 && <p className="text-sm text-muted">{t("taxiHint")}</p>}
        </section>
      )}

      <div className="rounded-2xl border border-ink/10">
        <button
          type="button"
          onClick={() => setAskOpen((o) => !o)}
          aria-expanded={askOpen}
          className="flex min-h-12 w-full items-center gap-2 px-4 font-semibold"
        >
          <MessageCircleQuestion aria-hidden="true" className="h-5 w-5" />
          {t("askGuide")}
        </button>
        {askOpen && (
          <div className="p-2">
            <GuideChat journey={journeySlug} stop={stop.order} place={stop.placeSlug ?? undefined} lang={lang} />
          </div>
        )}
      </div>
    </article>
  );
}

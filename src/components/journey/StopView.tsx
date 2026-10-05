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
}: {
  stop: PlayerStop;
  total: number;
  journeySlug: string;
  lang: "ar" | "en";
}) {
  const t = useTranslations("journey");
  const [kids, setKids] = useState(false);
  const [here, setHere] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    const sync = () => setHere(!!stop.placeSlug && readVisits().some((v) => v.slug === stop.placeSlug));
    sync();
    window.addEventListener(VISITS_EVENT, sync);
    return () => window.removeEventListener(VISITS_EVENT, sync);
  }, [stop.placeSlug]);

  const script = kids && stop.scriptKids ? stop.scriptKids : stop.script;

  return (
    <article className="space-y-5" aria-labelledby={`stop-${stop.order}`}>
      <header className="space-y-1">
        <p className="font-semibold text-brand">{t("stopOf", { n: stop.order, total })}</p>
        <h2 id={`stop-${stop.order}`} className="text-2xl leading-snug">
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
          <input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} className="h-5 w-5" />
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
          onClick={() => addVisit(stop.placeSlug!, "journey")}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-primary px-5 text-lg font-semibold text-brand disabled:border-transparent disabled:bg-primary/10"
        >
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          {here ? t("checkedIn") : t("checkIn")}
        </button>
      )}

      {(stop.hasStairs !== null || stop.walkingEffort || stop.visitMin) && (
        <ul className="space-y-1 text-muted">
          {stop.hasStairs === true && (
            <li className="flex items-center gap-2">
              <TriangleAlert aria-hidden="true" className="h-4 w-4 text-accent" />
              {t("hasStairs")}
            </li>
          )}
          {stop.visitMin && <li>{t("visitMinutes", { min: stop.visitMin })}</li>}
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

"use client";

import { useEffect, useState } from "react";
import Link from "@/components/i18n/Link";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, QrCode, Share2 } from "lucide-react";
import { useLang } from "@/lib/use-lang";
import { readAllJourneyProgress, readVisits, VISITS_EVENT, type JourneyProgress, type Visit } from "@/lib/visits";

/**
 * "My journey in Madinah": what this device has visited and completed. Reads
 * localStorage only; the page itself is static and identical for everyone.
 * Visits and stop progress are shared by both languages (same places).
 */
export function MyJourney({
  places,
  journeys,
}: {
  places: { slug: string; name: string }[];
  journeys: { slug: string; title: string; stops: number; placeSlugs: string[] }[];
}) {
  const t = useTranslations("journey");
  const lang = useLang();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [progress, setProgress] = useState<Record<string, JourneyProgress>>({});
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const sync = () => {
      setVisits(readVisits());
      setProgress(readAllJourneyProgress());
    };
    sync();
    window.addEventListener(VISITS_EVENT, sync);
    return () => window.removeEventListener(VISITS_EVENT, sync);
  }, []);

  if (visits === null) return null;
  const visited = new Set(visits.map((v) => v.slug));
  const count = places.filter((p) => visited.has(p.slug)).length;

  const share = async () => {
    const text = t("shareVisits", { count });
    // The home page in the visitor's language.
    const url = lang === "en" ? `${window.location.origin}/en` : window.location.origin;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
    } catch {
      // dismissed
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-3xl bg-primary p-6 text-paper">
        <p className="text-5xl font-bold ltr-nums">
          {count}
          <span className="text-2xl opacity-80"> / {places.length}</span>
        </p>
        <p className="text-lg">{t("visitedSummary", { count, total: places.length })}</p>
        {count > 0 && (
          <button type="button" onClick={share} className="flex min-h-12 items-center gap-2 rounded-2xl bg-paper/15 px-5 font-semibold">
            <Share2 aria-hidden="true" className="h-5 w-5" />
            {shared ? t("shared") : t("share")}
          </button>
        )}
      </section>

      {count === 0 && (
        <p className="flex items-start gap-3 rounded-2xl bg-surface p-4 leading-relaxed">
          <QrCode aria-hidden="true" className="mt-1 h-6 w-6 shrink-0" />
          {t("howToCheckIn")}
        </p>
      )}

      {journeys.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">{t("journeysProgress")}</h2>
          <ul className="space-y-3">
            {journeys.map((j) => {
              const p = progress[j.slug];
              const reached = p?.completed ? j.stops : Math.min(p?.stop ?? 0, j.stops);
              return (
                <li key={j.slug}>
                  <Link href={`/journeys/${j.slug}`} className="block space-y-2 rounded-2xl bg-surface p-4 shadow-sm">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-lg font-semibold">{j.title}</span>
                      <span className="text-sm text-muted ltr-nums">
                        {p?.completed ? t("completed") : t("stopsDone", { n: reached, total: j.stops })}
                      </span>
                    </span>
                    <span className="block h-2 overflow-hidden rounded-full bg-ink/10">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(reached / j.stops) * 100}%` }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl">{t("placesList")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {places.map((p) => (
            <li key={p.slug}>
              <Link href={`/places/${p.slug}`} className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-4">
                {visited.has(p.slug) ? (
                  <CheckCircle2 aria-label={t("visited")} className="h-5 w-5 shrink-0 text-brand" />
                ) : (
                  <Circle aria-label={t("notVisited")} className="h-5 w-5 shrink-0 text-muted" />
                )}
                <span className={visited.has(p.slug) ? "font-semibold" : ""}>{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted">{t("privacyNote")}</p>
    </div>
  );
}

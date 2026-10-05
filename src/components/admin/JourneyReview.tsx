"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Eye, X } from "lucide-react";
import {
  approveStopAction,
  setJourneyPublishedAction,
  setQuizStatusAction,
  setStopStatusAction,
} from "@/app/admin/(protected)/journeys/actions";

export type ReviewJourney = {
  slug: string;
  title: string;
  published: boolean;
  intro: string | null;
  stops: {
    id: string;
    order: number;
    title: string;
    status: string;
    script: string | null;
    scriptEn: string | null;
    kids: string | null;
    human: string | null;
    reflection: string | null;
    claims: { id: number; text: string; status: string; level: string; vol: number | null; page: number | null }[];
  }[];
  quiz: { id: string; question: string; options: string[]; answer: number; status: string }[];
};

const badge = (status: string) =>
  status === "verified" ? "bg-primary/15 text-brand-dark" : status === "rejected" ? "bg-basalt/15" : "bg-accent/20";

export function JourneyReview({ journey }: { journey: ReviewJourney }) {
  const t = useTranslations("admin.journeys");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const res = await fn();
      setError(!res.ok);
      router.refresh();
    });

  const verifiedStops = journey.stops.filter((s) => s.status === "verified").length;
  const verifiedQuiz = journey.quiz.filter((q) => q.status === "verified").length;
  const ready = verifiedStops === journey.stops.length && journey.stops.length > 0;

  return (
    <div className="space-y-6">
      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-surface/95 p-3 shadow-sm">
        <span className="font-semibold">
          {t("readiness", { stops: verifiedStops, total: journey.stops.length, quiz: verifiedQuiz })}
        </span>
        <Link href={`/admin/journeys/${journey.slug}/preview`} className="flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 px-4 font-medium">
          <Eye aria-hidden="true" className="h-5 w-5" />
          {t("preview")}
        </Link>
        <button
          type="button"
          disabled={busy || (!journey.published && !ready)}
          onClick={() => run(() => setJourneyPublishedAction({ slug: journey.slug, published: !journey.published }))}
          className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-paper disabled:opacity-50"
        >
          {journey.published ? t("unpublish") : t("publish")}
        </button>
        {!ready && !journey.published && <span className="text-sm text-muted">{t("publishHint")}</span>}
        {error && <span role="alert">{t("error")}</span>}
      </div>

      {journey.intro && <p className="rounded-2xl bg-surface p-4 leading-relaxed">{journey.intro}</p>}

      <ol className="space-y-5">
        {journey.stops.map((s) => {
          const pendingClaims = s.claims.filter((c) => c.status !== "verified").length;
          return (
            <li key={s.id} className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">
                  <span className="ltr-nums">{s.order}.</span> {s.title}
                </h3>
                <span className={`rounded-full px-3 py-1 text-sm ${badge(s.status)}`}>{t(`status.${s.status}`)}</span>
              </div>
              {s.script ? (
                <>
                  <p className="whitespace-pre-line text-lg leading-loose">{s.script}</p>
                  {s.scriptEn && <p dir="ltr" lang="en" className="text-start leading-relaxed text-muted">{s.scriptEn}</p>}
                  {s.human && <p className="rounded-xl bg-sand/60 p-3"><b>{t("human")}: </b>{s.human}</p>}
                  {s.kids && <p className="rounded-xl bg-sand/30 p-3"><b>{t("kids")}: </b>{s.kids}</p>}
                  {s.reflection && <p className="italic"><b className="not-italic">{t("reflection")}: </b>{s.reflection}</p>}
                  <details className="rounded-xl border border-ink/10 p-3" open={pendingClaims > 0}>
                    <summary className="cursor-pointer font-semibold">
                      {t("claims", { count: s.claims.length, pending: pendingClaims })}
                    </summary>
                    <ul className="mt-2 space-y-2 text-sm">
                      {s.claims.map((c) => (
                        <li key={c.id} className="leading-relaxed">
                          <span className={`me-2 rounded-full px-2 py-0.5 ${badge(c.status)}`}>C{c.id} · {c.level}</span>
                          {c.text}
                          <span className="text-muted"> — ج{c.vol ?? "?"} ص{c.page ?? "?"}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <div className="flex flex-wrap gap-2">
                    {s.status !== "verified" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => approveStopAction({ stopId: s.id, journeySlug: journey.slug, withClaims: true }))}
                        className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-paper disabled:opacity-50"
                      >
                        <Check aria-hidden="true" className="h-5 w-5" />
                        {pendingClaims ? t("approveWithClaims", { count: pendingClaims }) : t("approveStop")}
                      </button>
                    )}
                    {s.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => setStopStatusAction({ stopId: s.id, journeySlug: journey.slug, status: "rejected" }))}
                        className="flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 px-4 font-medium disabled:opacity-50"
                      >
                        <X aria-hidden="true" className="h-5 w-5" />
                        {t("reject")}
                      </button>
                    )}
                    {s.status !== "pending" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => setStopStatusAction({ stopId: s.id, journeySlug: journey.slug, status: "pending" }))}
                        className="min-h-11 px-3 font-medium underline disabled:opacity-50"
                      >
                        {t("backToPending")}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted">{t("noScript")}</p>
              )}
            </li>
          );
        })}
      </ol>

      {journey.quiz.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">{t("quiz")}</h3>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => setQuizStatusAction({ ids: journey.quiz.map((q) => q.id), journeySlug: journey.slug, status: "verified" }))}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-paper disabled:opacity-50"
            >
              <Check aria-hidden="true" className="h-5 w-5" />
              {t("approveQuiz")}
            </button>
          </div>
          <ol className="space-y-3">
            {journey.quiz.map((q, i) => (
              <li key={q.id} className="space-y-1">
                <p className="font-semibold">
                  <span className="ltr-nums">{i + 1}.</span> {q.question}{" "}
                  <span className={`rounded-full px-2 py-0.5 text-sm font-normal ${badge(q.status)}`}>{t(`status.${q.status}`)}</span>
                </p>
                <ul className="ms-5 list-disc text-sm">
                  {q.options.map((o, oi) => (
                    <li key={oi} className={oi === q.answer ? "font-bold text-brand" : ""}>
                      {o}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

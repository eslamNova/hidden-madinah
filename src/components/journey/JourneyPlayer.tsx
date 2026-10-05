"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/i18n/Link";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Clock, PartyPopper, RotateCcw, Share2 } from "lucide-react";
import { localizeHref } from "@/lib/i18n";
import type { PlayerJourney } from "@/lib/journey-view";
import { createClient } from "@/lib/supabase/client";
import {
  quizAnswers,
  quizAnswersPatch,
  readJourneyProgress,
  resetJourneyProgress,
  saveJourneyProgress,
  type JourneyProgress,
  type QuizAnswers,
} from "@/lib/visits";
import { JourneyQuiz, score } from "./JourneyQuiz";
import { StopView } from "./StopView";
import { TestimonialForm } from "./TestimonialForm";

type Step = "intro" | "pre" | number | "post" | "done";

const FAMILIARITY = ["new", "some", "good"] as const;

/**
 * The saved answers to this page's quiz: the page language's set (visits.ts),
 * and only when it still matches the questions — answers saved before the quiz
 * was edited would score the wrong options.
 */
function savedAnswers(journey: PlayerJourney, progress: JourneyProgress | null): QuizAnswers {
  const { pre, post } = quizAnswers(progress, journey.lang);
  const fits = (a: number[] | undefined) => (a && a.length === journey.quiz.length ? a : undefined);
  return { pre: fits(pre), post: fits(post) };
}

/**
 * A journey with a beginning, context and an end:
 * intro → pre-quiz → stops (narration, human moment, sources, guide) →
 * post-quiz → completion. Progress lives on the device (visits.ts); the only
 * thing ever sent is an anonymous before/after score, and only on request.
 */
export function JourneyPlayer({
  journey,
  preview = false,
  others = [],
}: {
  journey: PlayerJourney;
  preview?: boolean;
  others?: { slug: string; title: string }[];
}) {
  const t = useTranslations("journey");
  const tc = useTranslations("common");
  const [step, setStep] = useState<Step>("intro");
  const [progress, setProgress] = useState<JourneyProgress | null>(null);
  const [resumable, setResumable] = useState<JourneyProgress | null>(null);
  const [kids, setKids] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const hasQuiz = journey.quiz.length > 0;
  const lang = journey.lang;
  const Next = lang === "ar" ? ArrowLeft : ArrowRight;
  const Prev = lang === "ar" ? ArrowRight : ArrowLeft;
  const saved = savedAnswers(journey, progress);

  // The reviewer's preview never reads or writes the device's real progress.
  useEffect(() => {
    if (preview) return;
    const saved = readJourneyProgress(journey.slug);
    setProgress(saved);
    if (saved && saved.stop > 0 && !saved.completed) setResumable(saved);
  }, [journey.slug, preview]);

  // Functional updates: several patches in one handler (pre answers, then the
  // stop reached) must compose instead of overwriting each other.
  const update = (patch: Partial<JourneyProgress> | ((prev: JourneyProgress) => Partial<JourneyProgress>)) => {
    setProgress((prev) => {
      const base: JourneyProgress = { stop: 0, completed: false, ...prev };
      const p = typeof patch === "function" ? patch(base) : patch;
      if (!preview) saveJourneyProgress(journey.slug, p);
      return { ...base, ...p };
    });
  };

  const go = (s: Step) => {
    setStep(s);
    if (typeof s === "number") update((prev) => ({ stop: Math.max(prev.stop, s + 1) }));
  };

  // After every step change: bring the player into view and move focus to the
  // new heading, so screen-reader and keyboard users land on the new content.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    rootRef.current?.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
  }, [step]);

  const total = journey.stops.length;
  return (
    <div ref={rootRef} className="scroll-mt-4">
      {renderStep()}
    </div>
  );

  function renderStep() {
  // ── Intro ──────────────────────────────────────────────────────────────────
  if (step === "intro") {
    return (
      <section className="space-y-6">
        {journey.intro && <p className="text-lg leading-loose">{journey.intro}</p>}
        {lang === "en" && <p className="text-sm text-muted">{tc("translationNote")}</p>}
        <ul className="flex flex-wrap gap-2 text-sm">
          {journey.theme && <li className="rounded-full bg-primary/10 px-3 py-1 font-medium text-brand-dark">{journey.theme}</li>}
          {journey.durationMin && (
            <li className="flex items-center gap-1 rounded-full bg-surface px-3 py-1">
              <Clock aria-hidden="true" className="h-4 w-4" />
              <span className="ltr-nums">{t("duration", { min: journey.durationMin })}</span>
            </li>
          )}
          {journey.mode && <li className="rounded-full bg-surface px-3 py-1">{t(`mode.${journey.mode}`)}</li>}
        </ul>

        <ol className="space-y-2">
          {journey.stops.map((s) => (
            <li key={s.order} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-paper">
                <span className="ltr-nums leading-none">{s.index}</span>
              </span>
              <span className="text-lg">{s.title}</span>
            </li>
          ))}
        </ol>

        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("familiarityQ")}</legend>
          <p className="text-sm text-muted">{t("familiarityNote")}</p>
          <div className="flex flex-wrap gap-2">
            {FAMILIARITY.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={progress?.familiarity === f}
                onClick={() => update({ familiarity: f })}
                className={`min-h-11 rounded-full border px-4 py-2 font-medium ${
                  progress?.familiarity === f ? "border-primary bg-primary text-paper" : "border-ink/15 bg-surface"
                }`}
              >
                {t(`familiarity.${f}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          {resumable && (
            <button
              type="button"
              onClick={() => go(Math.min(resumable.stop, total) - 1)}
              className="flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-6 text-lg font-semibold text-paper"
            >
              {t("resume", { n: resumable.stop })}
              <Next aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => go(hasQuiz ? "pre" : 0)}
            className={`flex min-h-14 items-center gap-2 rounded-2xl px-6 text-lg font-semibold ${
              resumable ? "border-[1.5px] border-primary text-brand" : "bg-primary text-paper"
            }`}
          >
            {resumable ? t("restart") : t("begin")}
            <Next aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </section>
    );
  }

  // ── Quizzes ───────────────────────────────────────────────────────────────
  if (step === "pre") {
    return (
      <JourneyQuiz
        quiz={journey.quiz}
        phase="pre"
        initial={saved.pre?.some((a) => a >= 0) ? saved.pre : undefined}
        onDone={(answers) => {
          // "Skip" must not wipe answers given earlier.
          const skipped = answers.every((a) => a < 0);
          if (!(skipped && saved.pre?.some((a) => a >= 0))) update((prev) => quizAnswersPatch(prev, lang, { pre: answers }));
          go(0);
        }}
      />
    );
  }
  if (step === "post") {
    return (
      <JourneyQuiz
        quiz={journey.quiz}
        phase="post"
        initial={saved.post?.some((a) => a >= 0) ? saved.post : undefined}
        onBack={() => go(total - 1)}
        onDone={(answers) => {
          update((prev) => ({ ...quizAnswersPatch(prev, lang, { post: answers }), completed: true }));
          go("done");
        }}
      />
    );
  }

  // ── Completion ───────────────────────────────────────────────────────────
  if (step === "done") {
    return <Completion journey={journey} progress={progress} preview={preview} others={others} />;
  }

  // ── A stop ────────────────────────────────────────────────────────────────
  const stop = journey.stops[step];
  const isLast = step === total - 1;
  return (
    <div className="space-y-6">
      <div
        className="h-2 overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label={t("progress")}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      {/* Keyed: each stop mounts fresh (closed guide, closed sources). */}
      <StopView
        key={stop.order}
        stop={stop}
        total={total}
        journeySlug={journey.slug}
        lang={lang}
        preview={preview}
        kids={kids}
        onKidsChange={setKids}
      />

      <nav aria-label={t("stepsNav")} className="flex gap-3 border-t border-ink/10 pt-4">
        <button
          type="button"
          onClick={() => go(step === 0 ? "intro" : step - 1)}
          className="flex min-h-14 items-center gap-2 rounded-2xl border-[1.5px] border-ink/30 px-5 font-medium"
        >
          <Prev aria-hidden="true" className="h-5 w-5" />
          {t("previous")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isLast) return go(step + 1);
            if (hasQuiz) return go("post");
            update({ completed: true });
            go("done");
          }}
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-lg font-semibold text-paper"
        >
          {isLast ? t("toEnd") : t("nextStopBtn")}
          <Next aria-hidden="true" className="h-5 w-5" />
        </button>
      </nav>
    </div>
  );
  }
}

/** Module scope: defined inside Completion it remounted on every tap and lost focus. */
function Rating({ value, onChange, label }: { value: number | null; onChange: (n: number) => void; label: string }) {
  return (
    <fieldset>
      <legend className="mb-2 font-medium">{label}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`h-12 w-12 rounded-xl text-lg font-bold ${value === n ? "bg-primary text-paper" : "bg-surface"}`}
          >
            <span className="ltr-nums">{n}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Completion({
  journey,
  progress,
  preview,
  others,
}: {
  journey: PlayerJourney;
  progress: JourneyProgress | null;
  preview: boolean;
  others: { slug: string; title: string }[];
}) {
  const t = useTranslations("journey");
  const saved = savedAnswers(journey, progress);
  const pre = score(journey.quiz, saved.pre);
  const post = score(journey.quiz, saved.post);
  const [clarity, setClarity] = useState<number | null>(null);
  const [flow, setFlow] = useState<number | null>(null);
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | "error">(progress?.submitted ? "sent" : "idle");
  const [shared, setShared] = useState(false);

  const submit = async () => {
    if (preview) return setSent("sent");
    setSent("sending");
    const { error } = await createClient()
      .from("quiz_results")
      .insert({
        journey_slug: journey.slug,
        lang: journey.lang,
        familiarity: progress?.familiarity ?? null,
        pre_score: pre,
        post_score: post,
        total: journey.quiz.length,
        completed_stops: Math.min(progress?.stop ?? 0, journey.stops.length),
        total_stops: journey.stops.length,
        rating_clarity: clarity,
        rating_flow: flow,
      });
    if (error) return setSent("error");
    saveJourneyProgress(journey.slug, { submitted: true });
    setSent("sent");
  };

  const share = async () => {
    const text = t("shareText", { title: journey.title });
    const url = `${window.location.origin}${localizeHref(`/journeys/${journey.slug}`, journey.lang)}`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else await navigator.clipboard.writeText(`${text} ${url}`);
      setShared(true);
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2 rounded-3xl bg-primary p-6 text-paper">
        <PartyPopper aria-hidden="true" className="h-8 w-8" />
        <h2 tabIndex={-1} data-step-heading className="text-2xl outline-none">
          {t("doneTitle", { title: journey.title })}
        </h2>
        {pre !== null && post !== null ? (
          <p className="text-lg ltr-nums">{t("scoreCompare", { pre, post, total: journey.quiz.length })}</p>
        ) : post !== null ? (
          <p className="text-lg ltr-nums">{t("scoreOnly", { post, total: journey.quiz.length })}</p>
        ) : null}
      </div>

      {sent !== "sent" ? (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-4">
          <h3 className="text-lg font-semibold">{t("helpUs")}</h3>
          <Rating value={clarity} onChange={setClarity} label={t("rateClarity")} />
          <Rating value={flow} onChange={setFlow} label={t("rateFlow")} />
          <p className="text-sm text-muted">{t("anonNote")}</p>
          <button
            type="button"
            onClick={submit}
            disabled={sent === "sending"}
            className="min-h-12 rounded-2xl bg-primary px-6 font-semibold text-paper disabled:opacity-50"
          >
            {t("sendAnon")}
          </button>
          {sent === "error" && <p role="alert">{t("sendError")}</p>}
        </div>
      ) : (
        <p role="status" className="rounded-2xl bg-primary/10 p-4 font-medium text-brand-dark">
          {t("thanks")}
        </p>
      )}

      {/* Separate from the anonymous score above: this one is published (after
          review) and carries what the visitor chooses to write. */}
      <TestimonialForm journeySlug={journey.slug} lang={journey.lang} preview={preview} />

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={share} className="flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-primary px-5 font-semibold text-brand">
          <Share2 aria-hidden="true" className="h-5 w-5" />
          {shared ? t("shared") : t("share")}
        </button>
        <Link href="/my-journey" className="flex min-h-12 items-center rounded-2xl border-[1.5px] border-ink/30 px-5 font-medium">
          {t("myJourney")}
        </Link>
        {!preview && (
          <button
            type="button"
            onClick={() => {
              resetJourneyProgress(journey.slug);
              window.location.reload();
            }}
            className="flex min-h-12 items-center gap-2 px-3 font-medium underline"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {t("again")}
          </button>
        )}
      </div>

      {others.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{t("nextJourneys")}</h3>
          <ul className="space-y-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/journeys/${o.slug}`} className="flex min-h-12 items-center rounded-2xl bg-surface px-4 font-medium shadow-sm">
                  {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

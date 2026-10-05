"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import type { PlayerQuiz } from "@/lib/journey-view";

/**
 * The same three questions before and after the journey: the difference is
 * what the visitor learned (Track 3's success measure). Before: no feedback,
 * so the quiz doesn't teach the answers. After: correct answers + why.
 */
export function JourneyQuiz({
  quiz,
  phase,
  initial,
  onDone,
  onBack,
}: {
  quiz: PlayerQuiz[];
  phase: "pre" | "post";
  initial?: number[];
  onDone: (answers: number[]) => void;
  /** Post-quiz only: back to the last stop. */
  onBack?: () => void;
}) {
  const t = useTranslations("journey");
  const [answers, setAnswers] = useState<number[]>(initial ?? quiz.map(() => -1));
  const [revealed, setRevealed] = useState(false);
  const complete = answers.every((a) => a >= 0);

  return (
    <section className="space-y-5" aria-labelledby="quiz-title">
      <div className="space-y-1">
        <h2 id="quiz-title" tabIndex={-1} data-step-heading className="text-2xl outline-none">
          {phase === "pre" ? t("preTitle") : t("postTitle")}
        </h2>
        <p className="text-muted">{phase === "pre" ? t("preIntro") : t("postIntro")}</p>
      </div>

      <ol className="space-y-5">
        {quiz.map((q, qi) => (
          <li key={qi} className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
            <fieldset>
              <legend className="mb-3 text-lg font-semibold leading-relaxed">
                <span className="ltr-nums">{qi + 1}.</span> {q.question}
              </legend>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const chosen = answers[qi] === oi;
                  const correct = revealed && oi === q.answer;
                  const wrong = revealed && chosen && oi !== q.answer;
                  return (
                    <label
                      key={oi}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 ${
                        correct
                          ? "border-primary bg-primary/10"
                          : wrong
                            ? "border-accent bg-sand"
                            : chosen
                              ? "border-ink/50"
                              : "border-ink/15"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        checked={chosen}
                        disabled={revealed}
                        onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                        className="h-5 w-5"
                      />
                      <span className="flex-1">{opt}</span>
                      {correct && <CheckCircle2 aria-label={t("correct")} className="h-5 w-5 text-brand" />}
                      {wrong && <XCircle aria-label={t("incorrect")} className="h-5 w-5" />}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {revealed && q.explanation && (
              <p className="rounded-xl bg-sand/60 p-3 text-sm leading-relaxed">
                <span className="font-semibold">{t("because")} </span>
                {q.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        {phase === "post" && !revealed ? (
          <button
            type="button"
            disabled={!complete}
            onClick={() => setRevealed(true)}
            className="min-h-12 rounded-2xl bg-primary px-6 text-lg font-semibold text-paper disabled:opacity-50"
          >
            {t("showAnswers")}
          </button>
        ) : (
          <button
            type="button"
            disabled={!complete}
            onClick={() => onDone(answers)}
            className="min-h-12 rounded-2xl bg-primary px-6 text-lg font-semibold text-paper disabled:opacity-50"
          >
            {phase === "pre" ? t("startJourney") : t("finish")}
          </button>
        )}
        {onBack && (
          <button type="button" onClick={onBack} className="min-h-12 rounded-2xl border-[1.5px] border-ink/30 px-5 font-medium">
            {t("previous")}
          </button>
        )}
        {phase === "pre" && (
          <button
            type="button"
            onClick={() => onDone(quiz.map(() => -1))}
            className="min-h-12 rounded-2xl px-4 font-medium underline"
          >
            {t("skipQuiz")}
          </button>
        )}
      </div>
    </section>
  );
}

export function score(quiz: PlayerQuiz[], answers: number[] | undefined): number | null {
  if (!answers || answers.some((a) => a < 0)) return null;
  return quiz.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MessageSquareQuote, Send, TriangleAlert } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { TESTIMONIAL_LIMITS, charLength } from "@/lib/testimonials";

/** Journeys this device already sent a testimonial for — so the form isn't offered twice. */
const SENT_KEY = "hm-testimonials";

function readSent(): string[] {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function markSent(slug: string) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify([...new Set([...readSent(), slug])]));
  } catch {
    // Private mode or blocked storage: the form may simply be offered again.
  }
}

type Problem = "short" | "long" | "consent";

/** An error line that reads in both themes (no red token flips with dark mode). */
function Alert({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-2 font-semibold">
      <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <span>{children}</span>
    </p>
  );
}

/**
 * «شاركنا رأيك» at the end of a journey. Sends only what the visitor types
 * (text, optional name) plus the journey and its language, and only with the
 * consent box ticked. It goes in as 'pending' and appears on the home page
 * after an admin approves it. The reviewer's preview never inserts.
 */
export function TestimonialForm({ journeySlug, lang, preview }: { journeySlug: string; lang: Lang; preview: boolean }) {
  const t = useTranslations("journey.testimonial");
  const tj = useTranslations("journey");
  const id = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [problem, setProblem] = useState<Problem | null>(null);
  const { bodyMin, bodyMax, nameMax } = TESTIMONIAL_LIMITS;
  const length = charLength(body.trim());

  useEffect(() => {
    if (!preview && readSent().includes(journeySlug)) setState("sent");
  }, [journeySlug, preview]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    const found: Problem | null =
      charLength(text) < bodyMin ? "short" : charLength(text) > bodyMax ? "long" : !consent ? "consent" : null;
    setProblem(found);
    if (found) {
      (found === "consent" ? consentRef : bodyRef).current?.focus();
      return;
    }
    if (preview) return setState("sent");
    setState("sending");
    // No .select(): visitors can't read pending rows back, so asking for the
    // inserted row would turn a successful insert into an RLS error.
    const { error } = await createClient()
      .from("testimonials")
      .insert({
        body: text,
        display_name: name.trim() || null,
        lang,
        journey_slug: journeySlug,
        consent: true,
        status: "pending",
      });
    if (error) return setState("error");
    markSent(journeySlug);
    setState("sent");
  };

  if (state === "sent") {
    return (
      <p role="status" className="rounded-2xl bg-primary/10 p-4 font-medium text-brand-dark">
        {t("thanks")}
      </p>
    );
  }

  const bodyHint = `${id}-body-hint`;
  const bodyError = `${id}-body-error`;
  const nameHint = `${id}-name-hint`;
  const consentError = `${id}-consent-error`;
  const bodyProblem = problem === "short" || problem === "long";

  return (
    <form noValidate onSubmit={submit} className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquareQuote aria-hidden="true" className="h-6 w-6 shrink-0 text-brand" />
          {t("title")}
        </h3>
        <p className="text-muted">{t("intro")}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${id}-body`} className="block font-medium">
          {t("bodyLabel")}
        </label>
        <textarea
          ref={bodyRef}
          id={`${id}-body`}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (bodyProblem) setProblem(null);
          }}
          rows={4}
          maxLength={bodyMax}
          aria-invalid={bodyProblem || undefined}
          aria-describedby={bodyProblem ? `${bodyError} ${bodyHint}` : bodyHint}
          className="w-full rounded-xl border border-ink/20 bg-paper p-3 text-lg leading-relaxed"
        />
        <p id={bodyHint} className="flex flex-wrap justify-between gap-x-3 text-sm text-muted">
          <span>{t("bodyHint", { min: bodyMin, max: bodyMax })}</span>
          <span aria-hidden="true" className="ltr-nums">
            {length}/{bodyMax}
          </span>
        </p>
        {bodyProblem && (
          <Alert id={bodyError}>
            {problem === "short" ? t("tooShort", { min: bodyMin }) : t("tooLong", { max: bodyMax })}
          </Alert>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor={`${id}-name`} className="block font-medium">
          {t("nameLabel")}
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={nameMax}
          autoComplete="nickname"
          aria-describedby={nameHint}
          className="min-h-12 w-full rounded-xl border border-ink/20 bg-paper px-3 text-lg"
        />
        <p id={nameHint} className="text-sm text-muted">
          {t("nameHint")}
        </p>
      </div>

      <div className="space-y-1">
        <label className="flex min-h-12 cursor-pointer items-start gap-3 py-1 font-medium">
          <input
            ref={consentRef}
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              if (problem === "consent") setProblem(null);
            }}
            required
            aria-invalid={problem === "consent" || undefined}
            aria-describedby={problem === "consent" ? consentError : undefined}
            className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
          />
          <span>{t("consent")}</span>
        </label>
        {problem === "consent" && (
          <Alert id={consentError}>{t("consentRequired")}</Alert>
        )}
      </div>

      <p className="text-sm text-muted">{t("privacy")}</p>

      <button
        type="submit"
        disabled={state === "sending"}
        className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-6 font-semibold text-paper disabled:opacity-50"
      >
        {state === "sending" ? (
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
        ) : (
          <Send aria-hidden="true" className="h-5 w-5" />
        )}
        {state === "sending" ? t("sending") : t("submit")}
      </button>
      {state === "error" && (
        <Alert>{tj("sendError")}</Alert>
      )}
    </form>
  );
}

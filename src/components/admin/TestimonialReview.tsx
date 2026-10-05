"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, Loader2, RotateCcw, TriangleAlert, X } from "lucide-react";
import type { Enums, Tables } from "@/lib/database.types";
import { localizeHref } from "@/lib/i18n";
import { reviewTestimonialAction } from "@/app/(ar)/admin/(protected)/testimonials/actions";

type Status = Enums<"review_status">;

/** A row as the page prepares it: the date already formatted on the server (no hydration drift). */
export type ReviewTestimonial = Tables<"testimonials"> & { when: string; journeyTitle: string | null };

const toggle = (set: Set<number>, id: number, on: boolean) => {
  const next = new Set(set);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

/**
 * Moderation list for visitor testimonials. Optimistic like ClaimReviewList:
 * a card leaves the list the moment it's approved or rejected while the save
 * runs (spinner in the status line), and comes back marked if the save fails.
 * The action lives here, not in the card, so that feedback survives the card
 * unmounting.
 */
export function TestimonialReview({ items, status }: { items: ReviewTestimonial[]; status: Status }) {
  const t = useTranslations("admin.testimonials");
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const visible = items.filter((item) => !hidden.has(item.id));

  const act = (id: number, next: Status) => {
    setHidden((prev) => toggle(prev, id, true));
    setFailed((prev) => toggle(prev, id, false));
    setMessage(null);
    startTransition(async () => {
      const res = await reviewTestimonialAction({ id, status: next });
      if (res.ok) {
        setMessage(t(`done.${next}`));
        router.refresh();
      } else {
        setHidden((prev) => toggle(prev, id, false));
        setFailed((prev) => toggle(prev, id, true));
        setMessage(t("error"));
      }
    });
  };

  return (
    <div className="space-y-4">
      <p role="status" className="flex min-h-6 items-center gap-2 text-sm font-medium text-muted">
        {saving ? (
          <>
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            {t("saving")}
          </>
        ) : (
          message
        )}
      </p>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-surface p-4">{t(`none.${status}`)}</p>
      ) : (
        <ul className="space-y-4">
          {visible.map((item) => (
            <TestimonialCard key={item.id} item={item} failed={failed.has(item.id)} onAct={(next) => act(item.id, next)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TestimonialCard({
  item,
  failed,
  onAct,
}: {
  item: ReviewTestimonial;
  failed: boolean;
  onAct: (next: Status) => void;
}) {
  const t = useTranslations("admin.testimonials");
  const lang = item.lang === "en" ? "en" : item.lang === "ar" ? "ar" : null;

  return (
    <li className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-basalt/10 px-3 py-1">{t(`lang.${lang ?? "unknown"}`)}</span>
        {item.journey_slug && (
          <a
            href={localizeHref(`/journeys/${encodeURIComponent(item.journey_slug)}`, lang ?? "ar")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary/10 px-3 text-brand-dark underline"
          >
            {t("journey", { title: item.journeyTitle ?? item.journey_slug })}
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
        )}
        <span className="ltr-nums text-muted">{item.when}</span>
      </div>

      <blockquote
        lang={lang ?? undefined}
        dir={lang === "en" ? "ltr" : lang === "ar" ? "rtl" : "auto"}
        className="whitespace-pre-line rounded-xl bg-sand/40 p-3 text-start text-lg leading-relaxed"
      >
        {item.body}
      </blockquote>

      <p className="text-sm">
        <span className="font-semibold">{t("name")}: </span>
        {item.display_name?.trim() ? <bdi dir="auto">{item.display_name}</bdi> : t("noName")}
      </p>

      {!item.consent && (
        <p className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
          {t("noConsent")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {item.status !== "verified" && (
          <button
            type="button"
            disabled={!item.consent}
            onClick={() => onAct("verified")}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-paper disabled:opacity-50"
          >
            <Check aria-hidden="true" className="h-5 w-5" />
            {t("approve")}
          </button>
        )}
        {item.status !== "rejected" && (
          <button
            type="button"
            onClick={() => onAct("rejected")}
            className="flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 px-4 font-medium"
          >
            <X aria-hidden="true" className="h-5 w-5" />
            {item.status === "verified" ? t("unpublish") : t("reject")}
          </button>
        )}
        {item.status !== "pending" && (
          <button
            type="button"
            onClick={() => onAct("pending")}
            className="flex min-h-11 items-center gap-2 rounded-xl px-4 font-medium underline"
          >
            <RotateCcw aria-hidden="true" className="h-5 w-5" />
            {t("backToPending")}
          </button>
        )}
        {failed && (
          <span role="alert" className="flex items-center gap-1 self-center text-sm font-semibold">
            <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-accent" />
            {t("error")}
          </span>
        )}
      </div>
    </li>
  );
}

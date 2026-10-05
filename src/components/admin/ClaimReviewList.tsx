"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ExternalLink, TriangleAlert, X } from "lucide-react";
import type { Enums, Tables } from "@/lib/database.types";
import { approveClaimsAction, reviewClaimAction } from "@/app/admin/(protected)/claims/actions";

export type ReviewClaim = Tables<"claims">;

const TURATH_BOOK = "https://app.turath.io/book/23695";

export function ClaimReviewList({
  claims,
  status,
}: {
  claims: ReviewClaim[];
  status: Enums<"review_status">;
}) {
  const t = useTranslations("admin.claims");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (claims.length === 0) {
    return <p className="rounded-2xl border border-ink/10 bg-surface p-4">{t("none")}</p>;
  }

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const approveSelected = () =>
    startTransition(async () => {
      const res = await approveClaimsAction([...selected]);
      setMessage(res.ok ? t("approvedN", { count: res.data.count }) : t("error"));
      setSelected(new Set());
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {status === "pending" && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-surface/95 p-3 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() =>
              setSelected(selected.size === claims.length ? new Set() : new Set(claims.map((c) => c.id)))
            }
            className="min-h-11 rounded-xl border-[1.5px] border-ink/30 px-4 font-medium"
          >
            {selected.size === claims.length ? t("selectNone") : t("selectAll")}
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={approveSelected}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-paper disabled:opacity-50"
          >
            <Check aria-hidden="true" className="h-5 w-5" />
            {t("approveSelected", { count: selected.size })}
          </button>
          {message && <span role="status" className="text-sm text-muted">{message}</span>}
        </div>
      )}

      <ul className="space-y-4">
        {claims.map((c) => (
          <ClaimCard
            key={c.id}
            claim={c}
            checked={selected.has(c.id)}
            onToggle={status === "pending" ? () => toggle(c.id) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

function ClaimCard({
  claim,
  checked,
  onToggle,
}: {
  claim: ReviewClaim;
  checked: boolean;
  onToggle?: () => void;
}) {
  const t = useTranslations("admin.claims");
  const router = useRouter();
  const [text, setText] = useState(claim.text_ar);
  const [note, setNote] = useState(claim.reviewer_note ?? "");
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const edited = text.trim() !== claim.text_ar || note.trim() !== (claim.reviewer_note ?? "");

  const save = (status: Enums<"review_status">) =>
    startTransition(async () => {
      const res = await reviewClaimAction({
        id: claim.id,
        status,
        ...(edited ? { text_ar: text, reviewer_note: note } : {}),
      });
      setError(!res.ok);
      if (res.ok) router.refresh();
    });

  return (
    <li className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {onToggle && (
          <label className="flex min-h-11 items-center gap-2 font-medium">
            <input type="checkbox" checked={checked} onChange={onToggle} className="h-5 w-5" />
            <span className="ltr-nums">C{claim.id}</span>
          </label>
        )}
        <span className="rounded-full bg-basalt/10 px-3 py-1">{t(`kind.${claim.kind}`)}</span>
        <span className="rounded-full bg-basalt/10 px-3 py-1">
          {t("level")} {claim.content_level}
        </span>
        {claim.themes.map((th) => (
          <span key={th} className="rounded-full bg-primary/10 px-3 py-1 text-brand-dark">
            {th}
          </span>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">{t("claimText")}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.min(8, Math.max(2, Math.ceil(text.length / 70)))}
          className="w-full rounded-xl border border-ink/15 bg-sand/40 p-3 text-lg leading-relaxed"
        />
      </label>

      {claim.quote_ar && (
        <blockquote className="border-s-4 border-accent ps-3 leading-relaxed text-muted">
          «{claim.quote_ar}»
        </blockquote>
      )}

      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold">{t("source")}: </dt>
          <dd className="inline">
            <a
              href={TURATH_BOOK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              {t("dkiRef", { vol: claim.vol ?? "?", page: claim.page ?? "?" })}
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">{t("samarrai")}: </dt>
          <dd className="inline">
            {claim.needs_samarrai_check ? (
              <span className="inline-flex items-center gap-1 font-medium">
                <TriangleAlert aria-hidden="true" className="h-4 w-4 text-accent" />
                {claim.samarrai_ref ? t("samarraiProbable", { ref: claim.samarrai_ref }) : t("samarraiMissing")}
              </span>
            ) : (
              claim.samarrai_ref
            )}
          </dd>
        </div>
        {claim.hadith_ref && (
          <div>
            <dt className="inline font-semibold">{t("hadithRef")}: </dt>
            <dd className="inline">
              {claim.hadith_ref}
              {claim.grading && ` — ${claim.grading}`}
            </dd>
          </div>
        )}
      </dl>

      <label className="block text-sm">
        <span className="font-semibold">{t("note")}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-ink/15 bg-sand/40 px-3"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => save("verified")}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-paper disabled:opacity-50"
        >
          <Check aria-hidden="true" className="h-5 w-5" />
          {edited ? t("saveApprove") : t("approve")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save("rejected")}
          className="flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 px-4 font-medium disabled:opacity-50"
        >
          <X aria-hidden="true" className="h-5 w-5" />
          {t("reject")}
        </button>
        {claim.status !== "pending" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save("pending")}
            className="min-h-11 rounded-xl px-4 font-medium underline disabled:opacity-50"
          >
            {t("backToPending")}
          </button>
        )}
        {error && <span role="alert" className="self-center text-sm">{t("error")}</span>}
      </div>
    </li>
  );
}

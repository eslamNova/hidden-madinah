"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Check, Loader2, LocateFixed, Send, Sparkles } from "lucide-react";
import type { CitationInfo } from "@/lib/guide/context";

type Turn = {
  role: "user" | "model";
  text: string;
  type?: string;
  citations?: CitationInfo[];
  pending?: boolean;
  stage?: "search" | "facts";
  facts?: number;
};

type Props = {
  place?: string;
  journey?: string;
  stop?: number;
  lang?: "ar" | "en";
};

/** Renders [C12] markers as small numbered references matching the source list. */
function withRefs(text: string, citations: CitationInfo[] | undefined) {
  const order = new Map((citations ?? []).map((c, i) => [c.id, i + 1]));
  const parts = text.split(/(\[C\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[C(\d+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    const n = order.get(Number(m[1]));
    return n ? (
      <sup key={i} className="mx-0.5 font-bold text-brand-dark ltr-nums">
        [{n}]
      </sup>
    ) : null;
  });
}

export function GuideChat({ place, journey, stop, lang = "ar" }: Props) {
  const t = useTranslations("guide");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [elapsed, setElapsed] = useState(0);
  // Screen readers hear each finished answer once — not every streamed
  // fragment, and not the seconds counter.
  const [announce, setAnnounce] = useState("");

  // Seconds counter while an answer is on its way (free-tier models can take 10–20s).
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const suggestions = [t("suggestStory"), t("suggestNext"), t("suggestElderly")];

  const shareLocation = () => {
    setLocationError(false);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // ~100 m is enough for distances; no need to send an exact position.
        const round = (n: number) => Math.round(n * 1000) / 1000;
        setLocation({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  };

  // Grow the question box with its content (up to ~5 lines).
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };
  useEffect(() => {
    if (inputRef.current) autoGrow(inputRef.current);
  }, [input]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const history = turns
      .filter((tn) => !tn.pending)
      .map((tn) => ({ role: tn.role, text: tn.text }));
    setTurns((prev) => [...prev, { role: "user", text: q }, { role: "model", text: "", pending: true }]);

    const update = (patch: Partial<Turn>) =>
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });

    try {
      const res = await fetch("/api/guide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history, place, journey, stop, location: location ?? undefined }),
      });
      if (res.status === 429) {
        update({ text: t("busy"), pending: false, type: "refuse" });
        return;
      }
      if (!res.ok || !res.body) throw new Error(String(res.status));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";
      let finished = false;
      const handle = (line: string) => {
        if (!line.trim()) return;
        const evt = JSON.parse(line) as
          | { t: "p"; s: "search" | "facts"; n?: number }
          | { t: "d"; v: string }
          | { t: "m"; type: string; citations: CitationInfo[]; replace?: string };
        if (evt.t === "p") {
          update({ stage: evt.s, facts: evt.n });
        } else if (evt.t === "d") {
          text += evt.v;
          update({ text });
        } else {
          finished = true;
          update({ text: evt.replace ?? text, type: evt.type, citations: evt.citations, pending: false });
          setAnnounce(evt.replace ?? text);
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      buffer += decoder.decode();
      if (buffer.trim()) handle(buffer);
      // The connection ended without the final event: never leave the turn
      // spinning — keep what arrived, or say it failed.
      if (!finished) update({ text: text || t("error"), pending: false, type: text ? undefined : "refuse" });
    } catch {
      update({ text: t("error"), pending: false, type: "refuse" });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }));
    }
  }

  return (
    <section
      aria-labelledby="guide-title"
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="space-y-4 rounded-3xl border border-ink/10 bg-surface p-5 shadow-sm"
    >
      <div className="space-y-1">
        <h2 id="guide-title" className="flex items-center gap-2 text-xl">
          <Sparkles aria-hidden="true" className="h-6 w-6 text-accent" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted">{t("disclosure")}</p>
      </div>

      {turns.length > 0 && (
        <ol ref={listRef} className="space-y-3">
          {turns.map((tn, i) =>
            tn.role === "user" ? (
              <li key={i} className="ms-8 rounded-2xl bg-primary px-4 py-3 text-paper">
                {tn.text}
              </li>
            ) : (
              <li key={i} className="me-4 space-y-3 rounded-2xl bg-sand/60 px-4 py-3">
                {tn.pending && !tn.text ? (
                  <Progress stage={tn.stage} facts={tn.facts} elapsed={elapsed} />
                ) : (
                  <p className="whitespace-pre-line text-lg leading-relaxed">{withRefs(tn.text, tn.citations)}</p>
                )}
                {tn.citations && tn.citations.length > 0 && (
                  <div className="space-y-1 border-t border-ink/10 pt-2">
                    <p className="flex items-center gap-1 text-sm font-semibold">
                      <BookOpen aria-hidden="true" className="h-4 w-4" />
                      {t("sources")}
                    </p>
                    <ol className="space-y-1 text-sm text-muted">
                      {tn.citations.map((c, n) => (
                        <li key={c.id}>
                          <span className="font-bold ltr-nums">[{n + 1}]</span>{" "}
                          {t("citation", { vol: c.vol ?? "?", page: c.page ?? "?" })}
                          {c.samarrai && ` · ${t("samarrai", { ref: c.samarrai })}`}
                          {c.hadith && ` · ${c.hadith}${c.grading ? ` (${c.grading})` : ""}`}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </li>
            )
          )}
        </ol>
      )}

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="min-h-11 rounded-full border border-ink/15 bg-sand/50 px-4 py-2 text-start font-medium"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="flex items-end gap-2"
      >
        <label className="flex-1">
          <span className="sr-only">{t("inputLabel")}</span>
          <textarea
            value={input}
            ref={inputRef}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={2}
            maxLength={600}
            placeholder={t("placeholder")}
            className="min-h-12 w-full resize-none rounded-2xl border border-ink/15 bg-sand/40 px-4 py-3 text-lg"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label={t("send")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-paper disabled:opacity-50"
        >
          <Send aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" />
        </button>
      </form>

      <button
        type="button"
        onClick={shareLocation}
        disabled={locating || !!location}
        className="flex min-h-11 items-center gap-2 text-sm font-medium underline disabled:no-underline disabled:opacity-70"
      >
        <LocateFixed aria-hidden="true" className="h-4 w-4" />
        {location ? t("locationOn") : locating ? t("locating") : t("shareLocation")}
      </button>
      {locationError && (
        <p role="alert" className="text-sm">
          {t("locationError")}
        </p>
      )}
      <p role="status" className="sr-only">
        {announce}
      </p>
    </section>
  );
}

/** Three-step progress shown until the first words of the answer arrive. */
function Progress({ stage, facts, elapsed }: { stage?: "search" | "facts"; facts?: number; elapsed: number }) {
  const t = useTranslations("guide");
  const steps = [
    { done: stage === "facts", label: stage === "facts" ? t("stepFound", { count: facts ?? 0 }) : t("stepSearch") },
    { done: false, label: t("stepWriting"), active: stage === "facts" },
  ];
  return (
    <div role="status" className="space-y-2 text-muted">
      <ol className="space-y-1">
        {steps.map((st, i) => (
          <li key={i} className={`flex items-center gap-2 ${st.done || st.active || i === 0 ? "" : "opacity-50"}`}>
            {st.done ? (
              <Check aria-hidden="true" className="h-4 w-4 text-brand" />
            ) : (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            )}
            <span>{st.label}</span>
            {i === 1 && st.active && (
              <span aria-hidden="true" className="ltr-nums text-sm">
                ({elapsed}s)
              </span>
            )}
          </li>
        ))}
      </ol>
      {elapsed >= 8 && <p className="text-sm">{t("slowNote")}</p>}
    </div>
  );
}

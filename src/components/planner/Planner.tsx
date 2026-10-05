"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, Car, Footprints, Hotel, Loader2, LocateFixed, Map as MapIcon, Share2, Sparkles, TriangleAlert } from "lucide-react";
import { formatDistance, type LatLng } from "@/lib/geo";
import {
  solvePlan,
  type Companions,
  type Constraints,
  type Interest,
  type Mobility,
  type Mode,
  type PlannerPlace,
  type StartKey,
} from "@/lib/planner/solver";
import { parseRequestFallback, type ParsedRequest } from "@/lib/planner/parse";

const MINUTES = [30, 60, 90, 120, 180, 240] as const;
const COMPANIONS: Companions[] = ["alone", "family", "elderly", "kids"];
const INTERESTS: Interest[] = ["mosques", "battles", "wells_gardens"];
const STARTS: Exclude<StartKey, "custom">[] = ["nabawi", "quba", "uhud"];

type Form = {
  minutes: number;
  companions: Companions;
  mobility: Mobility;
  interests: Interest[];
  start: StartKey;
  mode: Mode | null;
};

const DEFAULT_FORM: Form = { minutes: 120, companions: "alone", mobility: "good", interests: [], start: "nabawi", mode: null };

/** Google Maps directions for the whole route (origin → waypoints → last stop). */
function mapsUrl(start: LatLng, stops: LatLng[], mode: Mode): string {
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  const params = new URLSearchParams({
    api: "1",
    origin: fmt(start),
    destination: fmt(stops[stops.length - 1]),
    travelmode: mode === "walk" ? "walking" : "driving",
  });
  if (stops.length > 1) params.set("waypoints", stops.slice(0, -1).map(fmt).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

export function Planner({ places }: { places: PlannerPlace[] }) {
  const t = useTranslations("plan");
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [custom, setCustom] = useState<{ point: LatLng; label: string | null; kind: "hotel" | "location" } | null>(null);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [understood, setUnderstood] = useState<{ parsed: ParsedRequest; source: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [shared, setShared] = useState(false);

  // Hotel mode: /plan?from=24.47,39.61&name=… (QR card at a hotel reception).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const from = sp.get("from")?.split(",").map(Number);
    if (from && from.length === 2 && from.every(Number.isFinite)) {
      setCustom({ point: { lat: from[0], lng: from[1] }, label: sp.get("name")?.slice(0, 80) ?? null, kind: "hotel" });
      setForm((f) => ({ ...f, start: "custom" }));
    }
  }, []);

  const constraints: Constraints = {
    ...form,
    startPoint: form.start === "custom" ? custom?.point ?? null : null,
    startLabel: form.start === "custom" ? custom?.label ?? null : null,
  };
  const plan = useMemo(() => solvePlan(places, constraints), [places, constraints.minutes, constraints.companions, constraints.mobility, constraints.interests.join(), constraints.start, constraints.mode, custom]); // eslint-disable-line react-hooks/exhaustive-deps
  const bySlug = useMemo(() => new Map(places.map((p) => [p.slug, p])), [places]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleInterest = (i: Interest) =>
    set("interests", form.interests.includes(i) ? form.interests.filter((x) => x !== i) : [...form.interests, i]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const round = (n: number) => Math.round(n * 1000) / 1000;
        setCustom({ point: { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) }, label: null, kind: "location" });
        set("start", "custom");
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10_000, maximumAge: 300_000 }
    );
  };

  const apply = (p: ParsedRequest, source: string) => {
    setForm((f) => ({
      minutes: p.minutes ?? f.minutes,
      companions: p.companions ?? f.companions,
      mobility: p.mobility ?? (p.companions === "elderly" ? "limited" : f.mobility),
      interests: p.interests.length ? p.interests : f.interests,
      start: p.start ?? (f.start === "custom" && custom ? "custom" : f.start),
      mode: p.mode ?? f.mode,
    }));
    setUnderstood({ parsed: p, source });
  };

  async function understand() {
    const q = text.trim();
    if (!q || parsing) return;
    // Instant answer from the on-device keyword reader; the AI then refines
    // it if it replies in time. A slow or failed AI never blocks the plan.
    apply(parseRequestFallback(q), "keywords");
    setParsing(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch("/api/plan/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: q }),
        signal: ctrl.signal,
      });
      const data = res.ok ? ((await res.json().catch(() => null)) as { parsed?: ParsedRequest; source?: string } | null) : null;
      if (data?.parsed && data.source === "ai") apply(data.parsed, "ai");
    } catch {
      // Timed out or offline: the keyword result already filled the form.
    } finally {
      clearTimeout(timer);
      setParsing(false);
    }
  }

  const share = async () => {
    const lines = plan.stops.map((s, i) => `${i + 1}. ${s.place.name}`).join("\n");
    const body = `${t("shareIntro", { minutes: form.minutes })}\n${lines}`;
    try {
      if (navigator.share) await navigator.share({ text: body, url: window.location.href });
      else await navigator.clipboard.writeText(`${body}\n${window.location.href}`);
      setShared(true);
    } catch {
      // dismissed
    }
  };

  const chip = (active: boolean) =>
    `min-h-11 rounded-full border px-4 py-2 font-medium ${active ? "border-primary bg-primary text-paper" : "border-ink/15 bg-surface"}`;

  return (
    <div className="space-y-8">
      {custom?.kind === "hotel" && (
        <p className="flex items-center gap-2 rounded-2xl bg-primary/10 p-4 font-medium text-brand-dark">
          <Hotel aria-hidden="true" className="h-5 w-5" />
          {custom.label ? t("hotelWelcome", { name: custom.label }) : t("hotelWelcomeGeneric")}
        </p>
      )}

      {/* ── Free text (AI reads it) ─────────────────────────────────────── */}
      <section className="space-y-3 rounded-3xl border border-ink/10 bg-surface p-5 shadow-sm" aria-labelledby="ask-title">
        <h2 id="ask-title" className="flex items-center gap-2 text-xl">
          <Sparkles aria-hidden="true" className="h-6 w-6 text-accent" />
          {t("askTitle")}
        </h2>
        <p className="text-sm text-muted">{t("askHint")}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={t("askPlaceholder")}
          className="w-full rounded-2xl border border-ink/15 bg-sand/40 p-3 text-lg leading-relaxed"
        />
        <button
          type="button"
          onClick={understand}
          disabled={parsing || !text.trim()}
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-lg font-semibold text-paper disabled:opacity-50"
        >
          {parsing && <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />}
          {t("understand")}
        </button>
        {understood && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            {parsing && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {parsing ? t("refining") : understood.source === "ai" ? t("understoodAi") : t("understoodKeywords")}
          </p>
        )}
      </section>

      {/* ── The five questions ─────────────────────────────────────────── */}
      <section className="space-y-5" aria-labelledby="form-title">
        <h2 id="form-title" className="text-xl">{t("formTitle")}</h2>

        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("qTime")}</legend>
          <div className="flex flex-wrap gap-2">
            {MINUTES.map((m) => (
              <button key={m} type="button" aria-pressed={form.minutes === m} onClick={() => set("minutes", m)} className={chip(form.minutes === m)}>
                {t(`minutes.${m}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("qWho")}</legend>
          <div className="flex flex-wrap gap-2">
            {COMPANIONS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={form.companions === c}
                onClick={() => setForm((f) => ({ ...f, companions: c, mobility: c === "elderly" ? "limited" : f.mobility }))}
                className={chip(form.companions === c)}
              >
                {t(`companions.${c}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("qWalk")}</legend>
          <div className="flex flex-wrap gap-2">
            {(["good", "limited"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={form.mobility === m} onClick={() => set("mobility", m)} className={chip(form.mobility === m)}>
                {t(`mobility.${m}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("qInterests")}</legend>
          <p className="text-sm text-muted">{t("qInterestsHint")}</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button key={i} type="button" aria-pressed={form.interests.includes(i)} onClick={() => toggleInterest(i)} className={chip(form.interests.includes(i))}>
                {t(`interests.${i}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("qStart")}</legend>
          <div className="flex flex-wrap gap-2">
            {STARTS.map((s) => (
              <button key={s} type="button" aria-pressed={form.start === s} onClick={() => set("start", s)} className={chip(form.start === s)}>
                {t(`starts.${s}`)}
              </button>
            ))}
            {custom && (
              <button type="button" aria-pressed={form.start === "custom"} onClick={() => set("start", "custom")} className={chip(form.start === "custom")}>
                {custom.kind === "hotel" ? custom.label ?? t("starts.hotel") : t("starts.location")}
              </button>
            )}
            <button type="button" onClick={useMyLocation} disabled={locating} className={`${chip(false)} flex items-center gap-2`}>
              {locating ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <LocateFixed aria-hidden="true" className="h-4 w-4" />}
              {t("myLocation")}
            </button>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("qMode")}</legend>
          <div className="flex flex-wrap gap-2">
            {([null, "walk", "car"] as const).map((m) => (
              <button key={m ?? "auto"} type="button" aria-pressed={form.mode === m} onClick={() => set("mode", m)} className={chip(form.mode === m)}>
                {t(`modes.${m ?? "auto"}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      {/* ── The plan ───────────────────────────────────────────────────── */}
      <section className="space-y-5" aria-labelledby="plan-title" aria-live="polite">
        <h2 id="plan-title" className="text-2xl">{t("planTitle")}</h2>
        {plan.stops.length === 0 ? (
          <p className="rounded-2xl bg-surface p-5 text-lg">{t("noPlan")}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-primary p-4 text-lg text-paper">
              <span className="flex items-center gap-2">
                {plan.mode === "walk" ? <Footprints aria-hidden="true" className="h-5 w-5" /> : <Car aria-hidden="true" className="h-5 w-5" />}
                {t("summary", { count: plan.stops.length, total: plan.totalMinutes, mode: plan.mode })}
              </span>
            </p>

            <ol className="space-y-4">
              {plan.stops.map((s, i) => {
                const warning = plan.warnings.find((w) => "slug" in w && w.slug === s.place.slug);
                const alt = warning?.kind === "stairs" && warning.alternative ? bySlug.get(warning.alternative) : null;
                return (
                  <li key={s.place.slug} className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      {s.leg.minutes === 0 ? (
                        <span>{t("legHere")}</span>
                      ) : s.leg.mode === "walk" ? (
                        <span className="flex items-center gap-1">
                          <Footprints aria-hidden="true" className="h-4 w-4" />
                          {t("legWalk", { min: s.leg.minutes, distance: formatDistance(s.leg.km) })}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Car aria-hidden="true" className="h-4 w-4" />
                          {t("legCar", { min: s.leg.minutes, distance: formatDistance(s.leg.km), from: s.leg.fareSar?.[0] ?? 0, to: s.leg.fareSar?.[1] ?? 0 })}
                        </span>
                      )}
                    </p>
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-paper">
                        <span className="ltr-nums leading-none">{i + 1}</span>
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Link href={`/places/${s.place.slug}`} className="text-xl font-semibold underline-offset-4 hover:underline">
                          {s.place.name}
                        </Link>
                        <p className="text-sm text-muted">{t("timing", { at: s.arriveAt, stay: s.visitMinutes })}</p>
                      </div>
                    </div>
                    {s.place.fact && (
                      <p className="flex gap-2 rounded-xl bg-sand/50 p-3 leading-relaxed">
                        <BookOpen aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
                        <span>
                          {s.place.fact.text}{" "}
                          <span className="text-sm text-muted">{t("factRef", { vol: s.place.fact.vol ?? "?", page: s.place.fact.page ?? "?" })}</span>
                        </span>
                      </p>
                    )}
                    {warning && (
                      <p className="flex gap-2 rounded-xl border-[1.5px] border-accent/60 p-3 text-sm leading-relaxed">
                        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <span>
                          {warning.kind === "stairs"
                            ? alt
                              ? t("warnStairsAlt", { alt: alt.name })
                              : t("warnStairs")
                            : warning.kind === "effort"
                              ? t("warnEffort")
                              : t("warnUnknown")}
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>

            {plan.warnings.some((w) => w.kind === "long_walk") && <p className="text-sm text-muted">{t("warnLongWalk")}</p>}
            {plan.stops.some((s) => s.leg.fareSar) && <p className="text-sm text-muted">{t("fareNote")}</p>}

            <div className="flex flex-wrap gap-3">
              <a
                href={mapsUrl(plan.start.point, plan.stops.map((s) => s.place), plan.mode)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-paper"
              >
                <MapIcon aria-hidden="true" className="h-5 w-5" />
                {t("openMaps")}
              </a>
              <button type="button" onClick={share} className="flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-primary px-5 font-semibold text-brand">
                <Share2 aria-hidden="true" className="h-5 w-5" />
                {shared ? t("shared") : t("share")}
              </button>
            </div>

            {plan.skipped.length > 0 && (
              <p className="text-muted">
                {t("moreTime")}{" "}
                {plan.skipped.map((slug, i) => (
                  <span key={slug}>
                    {i > 0 && "، "}
                    <Link href={`/places/${slug}`} className="underline">
                      {bySlug.get(slug)?.name ?? slug}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

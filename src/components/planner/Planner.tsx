"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, Car, Footprints, Hotel, Loader2, LocateFixed, Map as MapIcon, Share2, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import { formatDistance, type LatLng } from "@/lib/geo";
import {
  solvePlan,
  type Companions,
  type Constraints,
  type Interest,
  type Mobility,
  type Mode,
  type PlanLeg,
  type PlanWarning,
  type PlannerPlace,
  type StartKey,
} from "@/lib/planner/solver";
import { parseRequestFallback, type ParsedRequest } from "@/lib/planner/parse";

const MINUTES = [30, 60, 90, 120, 180, 240, 360] as const;
const COMPANIONS: Companions[] = ["alone", "family", "elderly", "kids"];
const INTERESTS: Interest[] = ["mosques", "battles", "wells_gardens"];
const STARTS: Exclude<StartKey, "custom">[] = ["nabawi", "quba", "uhud"];

/** The hotel (from a QR card) and the visitor's own location are separate choices. */
type StartChoice = Exclude<StartKey, "custom"> | "hotel" | "here";

type Form = {
  minutes: number;
  companions: Companions;
  mobility: Mobility;
  interests: Interest[];
  start: StartChoice;
  mode: Mode | null;
};

const DEFAULT_FORM: Form = { minutes: 120, companions: "alone", mobility: "good", interests: [], start: "nabawi", mode: null };

// Hotel links are printed on cards and can be edited by anyone: only accept
// a point in Madinah and a short plain-text name.
const MADINAH = { lat: [24.2, 24.8], lng: [39.3, 39.9] } as const;
const inMadinah = (p: LatLng) => p.lat >= MADINAH.lat[0] && p.lat <= MADINAH.lat[1] && p.lng >= MADINAH.lng[0] && p.lng <= MADINAH.lng[1];
const cleanName = (s: string | null) => {
  const name = (s ?? "").normalize("NFC").replace(/[^\p{L}\p{N}\p{M} '&.-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  return name.length > 1 ? name : null;
};

/** Google Maps allows only 3 waypoints on phones: longer routes are split into parts. */
const MAX_WAYPOINTS = 3;
function mapsUrls(start: LatLng, stops: LatLng[], mode: Mode): string[] {
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  const urls: string[] = [];
  let origin = start;
  for (let i = 0; i < stops.length; i += MAX_WAYPOINTS + 1) {
    const part = stops.slice(i, i + MAX_WAYPOINTS + 1);
    const params = new URLSearchParams({
      api: "1",
      origin: fmt(origin),
      destination: fmt(part[part.length - 1]),
      travelmode: mode === "walk" ? "walking" : "driving",
    });
    if (part.length > 1) params.set("waypoints", part.slice(0, -1).map(fmt).join("|"));
    urls.push(`https://www.google.com/maps/dir/?${params}`);
    origin = part[part.length - 1];
  }
  return urls;
}

/** Form → form with what the visitor's request said; unsaid fields keep their value. */
function applyParsed(f: Form, p: ParsedRequest): Form {
  return {
    minutes: p.minutes ?? f.minutes,
    companions: p.companions ?? f.companions,
    // Same default as tapping the "elderly" chip — visible and editable below.
    mobility: p.mobility ?? (p.companions === "elderly" ? "limited" : f.mobility),
    interests: p.interests.length ? p.interests : f.interests,
    start: p.start ?? f.start,
    mode: p.mode ?? f.mode,
  };
}

export function Planner({ places }: { places: PlannerPlace[] }) {
  const t = useTranslations("plan");
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [hotel, setHotel] = useState<{ point: LatLng; label: string | null } | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [understood, setUnderstood] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [shared, setShared] = useState(false);

  // Hotel mode: /plan?from=24.47,39.61&name=… (QR card at a hotel reception).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const from = sp.get("from")?.split(",").map((n) => Number(n.trim()));
    if (from?.length !== 2 || !from.every(Number.isFinite)) return;
    const point = { lat: from[0], lng: from[1] };
    if (!inMadinah(point)) return;
    setHotel({ point, label: cleanName(sp.get("name")) });
    setForm((f) => ({ ...f, start: "hotel" }));
  }, []);

  const startPoint = form.start === "hotel" ? hotel?.point ?? null : form.start === "here" ? here : null;
  const constraints: Constraints = {
    ...form,
    start: form.start === "hotel" || form.start === "here" ? "custom" : form.start,
    startPoint,
    startLabel: form.start === "hotel" ? hotel?.label ?? null : null,
  };
  const plan = useMemo(() => solvePlan(places, constraints), [places, constraints.minutes, constraints.companions, constraints.mobility, constraints.interests.join(), constraints.start, constraints.mode, startPoint?.lat, startPoint?.lng, constraints.startLabel]); // eslint-disable-line react-hooks/exhaustive-deps
  const bySlug = useMemo(() => new Map(places.map((p) => [p.slug, p])), [places]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleInterest = (i: Interest) =>
    set("interests", form.interests.includes(i) ? form.interests.filter((x) => x !== i) : [...form.interests, i]);

  const useMyLocation = () => {
    setLocationError(false);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const round = (n: number) => Math.round(n * 1000) / 1000;
        setHere({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
        set("start", "here");
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { timeout: 10_000, maximumAge: 300_000 }
    );
  };

  async function understand() {
    const q = text.trim();
    if (!q || parsing) return;
    // Instant answer from the on-device keyword reader; the AI then refines
    // it if it replies in time. A slow or failed AI never blocks the plan.
    // The AI's reading replaces the keyword one (not layered on top), so a
    // keyword misread doesn't survive the AI saying "not mentioned".
    const before = form;
    setForm(applyParsed(before, parseRequestFallback(q)));
    setUnderstood("keywords");
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
      if (data?.parsed && data.source === "ai") {
        setForm(applyParsed(before, data.parsed));
        setUnderstood("ai");
      }
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

  const warningText = (w: PlanWarning) => {
    switch (w.kind) {
      case "stairs": {
        const alt = w.alternative ? bySlug.get(w.alternative) : null;
        return alt ? t("warnStairsAlt", { alt: alt.name }) : t("warnStairs");
      }
      case "effort":
        return t("warnEffort");
      case "stairs_unknown":
        return t("warnStairsUnknown");
      case "access_unknown":
        return t("warnUnknown");
      default:
        return null;
    }
  };

  const legText = (leg: PlanLeg) =>
    leg.mode === "walk"
      ? t("legWalk", { min: leg.minutes, distance: formatDistance(leg.km) })
      : t("legCar", { min: leg.minutes, distance: formatDistance(leg.km), from: leg.fareSar?.[0] ?? 0, to: leg.fareSar?.[1] ?? 0 });

  const chip = (active: boolean) =>
    `min-h-11 rounded-full border px-4 py-2 font-medium ${active ? "border-primary bg-primary text-paper" : "border-ink/15 bg-surface"}`;

  const summary =
    plan.stops.length === 0 ? t("noPlan") : t("summary", { count: plan.stops.length, total: plan.totalMinutes, mode: plan.mode });
  const maps = mapsUrls(plan.start.point, plan.stops.map((s) => s.place), plan.mode);
  const customMinutes = !(MINUTES as readonly number[]).includes(form.minutes);

  return (
    <div className="space-y-8">
      {form.start === "hotel" && hotel && (
        <p className="flex items-center gap-2 rounded-2xl bg-primary/10 p-4 font-medium text-brand-dark">
          <Hotel aria-hidden="true" className="h-5 w-5" />
          {hotel.label ? t("hotelWelcome", { name: hotel.label }) : t("hotelWelcomeGeneric")}
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
            {parsing ? t("refining") : understood === "ai" ? t("understoodAi") : t("understoodKeywords")}
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
            {customMinutes && (
              <span className={chip(true)}>{t("minutesOther", { min: form.minutes })}</span>
            )}
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
            {hotel && (
              <button type="button" aria-pressed={form.start === "hotel"} onClick={() => set("start", "hotel")} className={chip(form.start === "hotel")}>
                {hotel.label ?? t("starts.hotel")}
              </button>
            )}
            {here && (
              <button type="button" aria-pressed={form.start === "here"} onClick={() => set("start", "here")} className={chip(form.start === "here")}>
                {t("starts.location")}
              </button>
            )}
            <button type="button" onClick={useMyLocation} disabled={locating} className={`${chip(false)} flex items-center gap-2`}>
              {locating ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <LocateFixed aria-hidden="true" className="h-4 w-4" />}
              {t("myLocation")}
            </button>
          </div>
          {locationError && (
            <p role="alert" className="text-sm text-red-700">
              {t("locationError")}
            </p>
          )}
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
      {/* One short announcement per change, not the whole list. */}
      <p role="status" className="sr-only">
        {summary}
      </p>
      <section className="space-y-5" aria-labelledby="plan-title">
        <h2 id="plan-title" className="text-2xl">{t("planTitle")}</h2>
        {plan.stops.length === 0 ? (
          <p className="rounded-2xl bg-surface p-5 text-lg">{summary}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-primary p-4 text-lg text-paper">
              <span className="flex items-center gap-2">
                {plan.mode === "walk" ? <Footprints aria-hidden="true" className="h-5 w-5" /> : <Car aria-hidden="true" className="h-5 w-5" />}
                {summary}
              </span>
            </p>

            <ol className="space-y-4">
              {plan.stops.map((s, i) => {
                const notes = plan.warnings
                  .filter((w) => "slug" in w && w.slug === s.place.slug)
                  .map(warningText)
                  .filter((x): x is string => !!x);
                return (
                  <li key={s.place.slug} className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      {s.leg.minutes === 0 ? (
                        <span>{t("legHere")}</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          {s.leg.mode === "walk" ? <Footprints aria-hidden="true" className="h-4 w-4" /> : <Car aria-hidden="true" className="h-4 w-4" />}
                          {legText(s.leg)}
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
                    {notes.map((note) => (
                      <p key={note} className="flex gap-2 rounded-xl border-[1.5px] border-accent/60 p-3 text-sm leading-relaxed">
                        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <span>{note}</span>
                      </p>
                    ))}
                  </li>
                );
              })}
            </ol>

            {plan.returnLeg && plan.returnLeg.minutes > 0 && (
              <p className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-surface p-4 text-muted">
                <Undo2 aria-hidden="true" className="h-5 w-5 shrink-0" />
                {t("legBack", { leg: legText(plan.returnLeg) })}
              </p>
            )}

            {plan.warnings.some((w) => w.kind === "long_walk") && <p className="text-sm text-muted">{t("warnLongWalk")}</p>}
            {(plan.stops.some((s) => s.leg.fareSar) || plan.returnLeg?.fareSar) && <p className="text-sm text-muted">{t("fareNote")}</p>}

            <div className="flex flex-wrap gap-3">
              {maps.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center gap-2 rounded-2xl bg-primary px-5 font-semibold text-paper"
                >
                  <MapIcon aria-hidden="true" className="h-5 w-5" />
                  {maps.length === 1 ? t("openMaps") : t("openMapsPart", { n: i + 1 })}
                </a>
              ))}
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

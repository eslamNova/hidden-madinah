"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { savePracticalAction, type PracticalInput } from "@/app/admin/(protected)/practical/actions";

export type PracticalRow = Omit<PracticalInput, "id" | "slug"> & {
  id: string;
  slug: string;
  name: string;
  published: boolean;
};

const tri = (v: boolean | null) => (v === null ? "" : v ? "yes" : "no");
const fromTri = (v: string): boolean | null => (v === "yes" ? true : v === "no" ? false : null);

/** One card per place: the few practical facts the planner and stop cards use. */
export function PracticalEditor({ rows }: { rows: PracticalRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <PracticalCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function PracticalCard({ row }: { row: PracticalRow }) {
  const t = useTranslations("admin.practical");
  const [v, setV] = useState(row);
  const [busy, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  // Stored hours can be richer than this editor (several ranges, weekdays):
  // only send them when the admin actually changed the hours.
  const [hoursTouched, setHoursTouched] = useState(false);
  const set = <K extends keyof PracticalRow>(k: K, value: PracticalRow[K]) => {
    setV((x) => ({ ...x, [k]: value }));
    setStatus("idle");
  };

  const setHours = (h: PracticalRow["hours"]) => {
    setHoursTouched(true);
    set("hours", h);
  };

  const save = () =>
    start(async () => {
      const res = await savePracticalAction({
        id: v.id,
        slug: v.slug,
        visit_minutes: v.visit_minutes,
        has_stairs: v.has_stairs,
        walking_effort: v.walking_effort,
        wheelchair_ok: v.wheelchair_ok,
        hours: hoursTouched ? v.hours : undefined,
      });
      setStatus(res.ok ? "saved" : "error");
    });

  const select = "min-h-11 w-full rounded-xl border border-ink/15 bg-sand/40 px-3";
  const hoursMode = v.hours === "always" ? "always" : Array.isArray(v.hours) ? "range" : "";

  return (
    <li className="space-y-3 rounded-2xl border border-ink/10 bg-surface p-4">
      <h3 className="text-lg font-semibold">
        {v.name} {!v.published && <span className="text-sm font-normal text-muted">(مسودة)</span>}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          {t("visitMinutes")}
          <input
            type="number"
            min={5}
            max={300}
            inputMode="numeric"
            value={v.visit_minutes ?? ""}
            onChange={(e) => set("visit_minutes", e.target.value ? Number(e.target.value) : null)}
            className={select}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("stairs")}
          <select value={tri(v.has_stairs)} onChange={(e) => set("has_stairs", fromTri(e.target.value))} className={select}>
            <option value="">{t("unknown")}</option>
            <option value="yes">{t("yes")}</option>
            <option value="no">{t("no")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("effort")}
          <select
            value={v.walking_effort ?? ""}
            onChange={(e) => set("walking_effort", (e.target.value || null) as PracticalRow["walking_effort"])}
            className={select}
          >
            <option value="">{t("unknown")}</option>
            <option value="low">{t("low")}</option>
            <option value="medium">{t("medium")}</option>
            <option value="high">{t("high")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("wheelchair")}
          <select value={tri(v.wheelchair_ok)} onChange={(e) => set("wheelchair_ok", fromTri(e.target.value))} className={select}>
            <option value="">{t("unknown")}</option>
            <option value="yes">{t("yes")}</option>
            <option value="no">{t("no")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t("hours")}
          <select
            value={hoursMode}
            onChange={(e) => setHours( e.target.value === "always" ? "always" : e.target.value === "range" ? ["05:00", "22:00"] : null)}
            className={select}
          >
            <option value="">{t("unknown")}</option>
            <option value="always">{t("always")}</option>
            <option value="range">
              {t("from")} … {t("to")} …
            </option>
          </select>
        </label>
        {Array.isArray(v.hours) && (
          <div className="flex items-end gap-2">
            <label className="flex-1 space-y-1 text-sm font-medium">
              {t("from")}
              <input type="time" value={v.hours[0]} onChange={(e) => setHours( [e.target.value, (v.hours as [string, string])[1]])} className={select} />
            </label>
            <label className="flex-1 space-y-1 text-sm font-medium">
              {t("to")}
              <input type="time" value={v.hours[1]} onChange={(e) => setHours( [(v.hours as [string, string])[0], e.target.value])} className={select} />
            </label>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-paper disabled:opacity-50"
        >
          {busy ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Check aria-hidden="true" className="h-5 w-5" />}
          {t("save")}
        </button>
        {status === "saved" && <span role="status" className="text-sm text-brand">{t("saved")}</span>}
        {status === "error" && <span role="alert" className="text-sm">{t("error")}</span>}
      </div>
    </li>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { List, Map as MapIcon, Search } from "lucide-react";
import { arabicIncludes, normalizeArabic } from "@/lib/arabic";
import { CATEGORY_META, CATEGORY_ORDER, type PlaceCategory } from "@/lib/maps";
import { PlaceCard, type PlaceCardData } from "@/components/place/PlaceCard";

export type ExplorerPlace = PlaceCardData & {
  bestTime: string | null;
  driveTimeMin: number | null;
};

type DistanceFilter = "all" | "under2" | "2to5" | "over5";
type TimeFilter = "all" | "morning" | "asr" | "evening";

const TIME_KEYWORDS: Record<Exclude<TimeFilter, "all">, string[]> = {
  morning: ["صباح"],
  asr: ["عصر", "ظهر"],
  evening: ["مغرب", "مساء", "غروب", "عشاء"],
};

function matchesDistance(km: number | null, filter: DistanceFilter): boolean {
  if (filter === "all") return true;
  if (km == null) return false;
  if (filter === "under2") return km < 2;
  if (filter === "2to5") return km >= 2 && km <= 5;
  return km > 5;
}

function matchesTime(bestTime: string | null, filter: TimeFilter): boolean {
  if (filter === "all") return true;
  if (!bestTime) return false;
  const normalized = normalizeArabic(bestTime);
  return TIME_KEYWORDS[filter].some((k) => normalized.includes(normalizeArabic(k)));
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 rounded-full border-[1.5px] px-4 text-base font-medium ${
        active
          ? "border-primary bg-primary text-surface"
          : "border-basalt/30 bg-surface text-basalt"
      }`}
    >
      {children}
    </button>
  );
}

/** Client-side search + filters over the (small) published-places list. */
export function PlacesExplorer({
  places,
  initialCategory,
}: {
  places: ExplorerPlace[];
  initialCategory?: string;
}) {
  const t = useTranslations("places");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "all">(
    CATEGORY_ORDER.includes(initialCategory as PlaceCategory)
      ? (initialCategory as PlaceCategory)
      : "all"
  );
  const [distance, setDistance] = useState<DistanceFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");

  const filtered = useMemo(
    () =>
      places.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          matchesDistance(p.distanceKm, distance) &&
          matchesTime(p.bestTime, time) &&
          (query.trim() === "" ||
            arabicIncludes(p.name_ar, query) ||
            (p.summary ? arabicIncludes(p.summary, query) : false))
      ),
    [places, category, distance, time, query]
  );

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="place-search" className="mb-2 block text-base font-semibold">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
          />
          <input
            id="place-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="min-h-[52px] w-full rounded-2xl border-[1.5px] border-basalt/30 bg-surface ps-12 pe-4 text-lg"
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-semibold">{t("filterCategory")}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            {t("all")}
          </Chip>
          {CATEGORY_ORDER.filter((c) => c !== "other").map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_META[c].pluralAr}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-base font-semibold">{t("filterDistance")}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={distance === "all"} onClick={() => setDistance("all")}>
            {t("all")}
          </Chip>
          <Chip active={distance === "under2"} onClick={() => setDistance("under2")}>
            {t("distanceUnder2")}
          </Chip>
          <Chip active={distance === "2to5"} onClick={() => setDistance("2to5")}>
            {t("distance2to5")}
          </Chip>
          <Chip active={distance === "over5"} onClick={() => setDistance("over5")}>
            {t("distanceOver5")}
          </Chip>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-base font-semibold">{t("filterBestTime")}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip active={time === "all"} onClick={() => setTime("all")}>
            {t("all")}
          </Chip>
          <Chip active={time === "morning"} onClick={() => setTime("morning")}>
            {t("timeMorning")}
          </Chip>
          <Chip active={time === "asr"} onClick={() => setTime("asr")}>
            {t("timeAsr")}
          </Chip>
          <Chip active={time === "evening"} onClick={() => setTime("evening")}>
            {t("timeEvening")}
          </Chip>
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-4">
        <p aria-live="polite" className="text-base text-muted">
          {t("count", { count: filtered.length })}
        </p>
        <div className="flex overflow-hidden rounded-xl border-[1.5px] border-basalt/30">
          <span className="flex min-h-12 items-center gap-1.5 bg-primary px-4 font-medium text-surface">
            <List aria-hidden="true" className="h-5 w-5" />
            {t("listView")}
          </span>
          <Link
            href="/map"
            className="flex min-h-12 items-center gap-1.5 bg-surface px-4 font-medium text-basalt"
          >
            <MapIcon aria-hidden="true" className="h-5 w-5" />
            {t("mapView")}
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-surface p-8 text-center">
          <p className="text-lg">{t("empty")}</p>
          <p className="mt-1 text-muted">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((p) => (
            <PlaceCard key={p.slug} place={p} />
          ))}
        </div>
      )}
    </div>
  );
}
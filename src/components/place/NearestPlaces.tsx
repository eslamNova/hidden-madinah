"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, LocateFixed } from "lucide-react";
import { haversineKm } from "@/lib/geo";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import { CategoryIcon } from "@/components/CategoryIcon";

export type NearestPlaceInput = {
  slug: string;
  name_ar: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
};

type Status = "idle" | "loading" | "ready" | "denied";

/** "أقرب الأماكن إليك" — geolocation on explicit request only. */
export function NearestPlaces({ places }: { places: NearestPlaceInput[] }) {
  const t = useTranslations("home");
  const [status, setStatus] = useState<Status>("idle");
  const [nearest, setNearest] = useState<(NearestPlaceInput & { km: number })[]>([]);

  if (places.length === 0) return null;

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const sorted = places
          .map((p) => ({ ...p, km: Math.round(haversineKm(here, p) * 10) / 10 }))
          .sort((a, b) => a.km - b.km)
          .slice(0, 3);
        setNearest(sorted);
        setStatus("ready");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <section aria-label={t("nearestTitle")} className="space-y-4">
      <h2 className="text-2xl">{t("nearestTitle")}</h2>

      {status === "idle" && (
        <div className="card-elevated p-5">
          <p className="mb-4 text-muted">{t("nearestPrompt")}</p>
          <button
            type="button"
            onClick={locate}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-semibold text-paper sm:w-auto"
          >
            <LocateFixed aria-hidden="true" className="h-6 w-6" />
            {t("nearestButton")}
          </button>
        </div>
      )}

      {status === "loading" && (
        <p role="status" className="card-elevated p-5 text-muted">
          {t("nearestLoading")}
        </p>
      )}

      {status === "denied" && (
        <p role="status" className="card-elevated p-5 text-muted">
          {t("nearestDenied")}
        </p>
      )}

      {status === "ready" && (
        <ul className="space-y-3">
          {nearest.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/places/${encodeURIComponent(p.slug)}`}
                className="card-elevated press flex min-h-14 items-center gap-3 p-4"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${CATEGORY_META[p.category].color}1f` }}
                >
                  <CategoryIcon category={p.category} className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  {/* No truncate: long names (مسجد العُصْبة …) wrap instead of
                      ending in an ellipsis; the row grows past its min-h-14. */}
                  <span className="block text-lg font-semibold">{p.name_ar}</span>
                  <span className="block text-base text-muted">
                    {t("nearestKm", { km: p.km })}
                  </span>
                </span>
                <ChevronLeft aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
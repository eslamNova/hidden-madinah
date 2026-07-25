"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import { PlaceImage } from "@/components/place/PlaceImage";

export type MapPlacePreview = {
  slug: string;
  name_ar: string;
  category: PlaceCategory;
  summary: string | null;
  distanceKm: number | null;
  thumb: { url: string; width: number; height: number } | null;
};

/** Bottom sheet preview shown when a map pin is tapped. */
export function MapBottomSheet({
  place,
  onClose,
}: {
  place: MapPlacePreview | null;
  onClose: () => void;
}) {
  const t = useTranslations("map");
  const tCommon = useTranslations("common");
  const tPlace = useTranslations("place");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!place) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [place, onClose]);

  if (!place) return null;

  const meta = CATEGORY_META[place.category];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={place.name_ar}
      className="fixed inset-x-0 bottom-[4.5rem] z-50 mx-auto max-w-lg px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="rounded-t-3xl border border-basalt/10 bg-surface p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {place.thumb ? (
              <PlaceImage
                media={place.thumb}
                alt={place.name_ar}
                sizes="96px"
                className="h-20 w-20 rounded-xl object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-20 w-20 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${meta.color}1f` }}
              >
                <span
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
              </span>
            )}
            <div>
              <h2 className="text-xl leading-snug">{place.name_ar}</h2>
              <p className="text-sm text-muted">{meta.labelAr}</p>
              {place.distanceKm != null && (
                <p className="text-sm text-muted">
                  {tCommon("distanceKm", { km: place.distanceKm })}
                </p>
              )}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("closePreview")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-basalt/30 bg-surface text-basalt"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {place.summary && (
          <p className="mb-4 line-clamp-2 text-base leading-relaxed text-muted">
            {place.summary}
          </p>
        )}
        <Link
          href={`/places/${encodeURIComponent(place.slug)}`}
          className="flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 text-lg font-semibold text-surface"
        >
          {t("openPlace")}
        </Link>
        <span className="sr-only">{tPlace("visitInfo")}</span>
      </div>
    </div>
  );
}
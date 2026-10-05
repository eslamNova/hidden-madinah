"use client";

import { useEffect, useRef, useState } from "react";
import {
  GeolocateControl,
  Map as MaplibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { MADINAH_BOUNDS, MADINAH_CENTER } from "@/lib/geo";
import { CATEGORY_META, CATEGORY_ORDER, mapStyleUrl } from "@/lib/maps";
import { useLang } from "@/lib/use-lang";
import { useTheme } from "@/lib/use-theme";
import {
  applyMapLabels,
  createPinElement,
  ensureRtlTextPlugin,
  mapControlCorner,
} from "./map-utils";
import { MapBottomSheet, type MapPlacePreview } from "./MapBottomSheet";

export type MapPin = {
  place: MapPlacePreview;
  lat: number;
  lng: number;
};

/**
 * Full-screen category-pinned map of all published places. Pins arrive as
 * SSG props from the server (same 24h revalidate as every other page) — no
 * client-side Supabase fetch, so supabase-js stays out of this bundle and
 * pins mount together with the map instead of popping in later.
 */
export function MapView({ pins }: { pins: MapPin[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selected, setSelected] = useState<MapPlacePreview | null>(null);
  const [loading, setLoading] = useState(true);
  // Camera survives the theme re-create so a toggle never resets the view.
  const viewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const t = useTranslations("map");
  const tPlaces = useTranslations("places");
  const [theme] = useTheme();
  const lang = useLang();

  // Re-created on theme change so the tile style follows light/dark; the
  // markers effect below re-adds the pins (theme and lang in its deps too).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureRtlTextPlugin();

    const map = new MaplibreMap({
      container,
      style: mapStyleUrl(theme),
      center: viewRef.current?.center ?? [MADINAH_CENTER.lng, MADINAH_CENTER.lat],
      zoom: viewRef.current?.zoom ?? 12,
      minZoom: 10,
      maxBounds: MADINAH_BOUNDS,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), mapControlCorner(lang));
    map.addControl(new GeolocateControl({ trackUserLocation: false }), mapControlCorner(lang));
    setLoading(true);
    map.on("load", () => {
      applyMapLabels(map, lang);
      setLoading(false);
    });
    mapRef.current = map;

    return () => {
      const c = map.getCenter();
      viewRef.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [theme, lang]);

  // Markers mount once — pins are static SSG data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = pins.map(({ place, lat, lng }) => {
      const el = createPinElement(CATEGORY_META[place.category].color, place.name_ar);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(place);
      });
      return new Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    });
  }, [pins, theme, lang]);

  return (
    // 5.5rem = floating-dock clearance only; there is no top bar anymore.
    <div className="relative h-[calc(100dvh-5.5rem)] w-full">
      {/* Cross-fade the sand veil away once tiles are ready — the map warms
          up underneath instead of popping into view. */}
      <p
        role="status"
        className={`absolute inset-0 z-10 flex items-center justify-center bg-sand text-lg text-muted transition-opacity duration-500 ease-out ${
          loading ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {loading ? t("loading") : ""}
      </p>
      <div ref={containerRef} className="h-full w-full" aria-label={t("title")} />
      {/* end = the corner maplibre puts its 48px zoom/geolocate stack in
          (physical left in RTL, right in LTR — see mapControlCorner), so
          inset past it. */}
      <details className="absolute end-[4.5rem] top-2 z-10 rounded-2xl border border-ink/10 bg-surface/95 p-2.5 shadow-lg">
        <summary className="press flex min-h-12 cursor-pointer items-center gap-1 rounded-lg px-2 text-base font-semibold">
          {t("legend")}
        </summary>
        <ul className="mt-1 space-y-2 px-2 pb-1 text-base">
          {CATEGORY_ORDER.filter((c) => c !== "other").map((c) => (
            <li key={c} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full border-2 border-surface shadow"
                style={{ backgroundColor: CATEGORY_META[c].color }}
              />
              <span>{tPlaces(`category.${c}`)}</span>
            </li>
          ))}
        </ul>
      </details>
      <MapBottomSheet place={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { MADINAH_BOUNDS } from "@/lib/geo";
import { mapStyleUrl } from "@/lib/maps";
import { useLang } from "@/lib/use-lang";
import { useTheme } from "@/lib/use-theme";
import { applyMapLabels, ensureRtlTextPlugin, mapControlCorner } from "./map-utils";

/** Small embedded map with a single pin, for the place detail page. */
export function PlaceMap({
  lat,
  lng,
  nameAr,
  color,
}: {
  lat: number;
  lng: number;
  nameAr: string;
  color: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("map");
  const [theme] = useTheme();
  const lang = useLang();

  // Re-created on theme change so the tile style follows light/dark.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureRtlTextPlugin();

    const map = new MaplibreMap({
      container,
      style: mapStyleUrl(theme),
      center: [lng, lat],
      zoom: 14,
      minZoom: 10,
      maxBounds: MADINAH_BOUNDS,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), mapControlCorner(lang));
    map.on("load", () => applyMapLabels(map, lang));

    const marker = new Marker({ color }).setLngLat([lng, lat]).addTo(map);

    return () => {
      marker.remove();
      map.remove();
    };
  }, [lat, lng, color, theme, lang]);

  return (
    <div
      ref={containerRef}
      className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink/10"
      role="application"
      aria-label={`${t("title")}: ${nameAr}`}
    />
  );
}

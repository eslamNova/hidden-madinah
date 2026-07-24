"use client";

import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { MADINAH_BOUNDS } from "@/lib/geo";
import { MAP_STYLE_URL } from "@/lib/maps";
import { applyArabicLabels, ensureRtlTextPlugin } from "./map-utils";

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureRtlTextPlugin();

    const map = new MaplibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [lng, lat],
      zoom: 14,
      minZoom: 10,
      maxBounds: MADINAH_BOUNDS,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    map.on("load", () => applyArabicLabels(map));

    const marker = new Marker({ color }).setLngLat([lng, lat]).addTo(map);

    return () => {
      marker.remove();
      map.remove();
    };
  }, [lat, lng, color]);

  return (
    <div
      ref={containerRef}
      className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-basalt/10"
      role="application"
      aria-label={`${t("title")}: ${nameAr}`}
    />
  );
}

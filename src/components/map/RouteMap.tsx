"use client";

import { useEffect, useRef } from "react";
import {
  LngLatBounds,
  Map as MaplibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { MADINAH_BOUNDS } from "@/lib/geo";
import { MAP_STYLE_URL } from "@/lib/maps";
import {
  applyArabicLabels,
  createNumberedPinElement,
  ensureRtlTextPlugin,
} from "./map-utils";

export type RouteMapStop = {
  lat: number;
  lng: number;
  nameAr: string;
  slug: string;
};

/** Route map: numbered stop pins connected by a line, fit to the stops. */
export function RouteMap({ stops }: { stops: RouteMapStop[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("map");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || stops.length === 0) return;
    ensureRtlTextPlugin();

    const bounds = new LngLatBounds();
    for (const s of stops) bounds.extend([s.lng, s.lat]);

    const map = new MaplibreMap({
      container,
      style: MAP_STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 60, maxZoom: 15 },
      minZoom: 10,
      maxBounds: MADINAH_BOUNDS,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");

    map.on("load", () => {
      applyArabicLabels(map);
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: stops.map((s) => [s.lng, s.lat]),
          },
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#1F5C3D",
          "line-width": 3,
          "line-dasharray": [2, 1.5],
          "line-opacity": 0.85,
        },
      });
    });

    const markers = stops.map((s, i) =>
      new Marker({ element: createNumberedPinElement(i + 1) })
        .setLngLat([s.lng, s.lat])
        .addTo(map)
    );

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
  }, [stops]);

  if (stops.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-basalt/10"
      role="application"
      aria-label={t("title")}
    />
  );
}

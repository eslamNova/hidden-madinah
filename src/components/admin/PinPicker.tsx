"use client";

import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { Crosshair } from "lucide-react";
import { distanceFromHaramKm, MADINAH_BOUNDS, MADINAH_CENTER } from "@/lib/geo";
import { MAP_STYLE_URL } from "@/lib/maps";
import { applyArabicLabels, ensureRtlTextPlugin } from "@/components/map/map-utils";

export type PinChange = { lat: number; lng: number; suggestedKm: number };

/** Draggable-pin picker for the admin form; suggests the Haversine distance. */
export function PinPicker({
  lat,
  lng,
  exifSuggestion,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  exifSuggestion: { lat: number; lng: number } | null;
  onChange: (change: PinChange) => void;
}) {
  const t = useTranslations("admin.pin");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureRtlTextPlugin();

    const start = {
      lat: lat ?? MADINAH_CENTER.lat,
      lng: lng ?? MADINAH_CENTER.lng,
    };

    const map = new MaplibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [start.lng, start.lat],
      zoom: lat != null ? 14 : 12,
      minZoom: 10,
      maxBounds: MADINAH_BOUNDS,
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    map.on("load", () => applyArabicLabels(map));

    const marker = new Marker({ color: "#1F5C3D", draggable: true })
      .setLngLat([start.lng, start.lat])
      .addTo(map);
    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      onChangeRef.current({
        lat: Math.round(pos.lat * 1e6) / 1e6,
        lng: Math.round(pos.lng * 1e6) / 1e6,
        suggestedKm: distanceFromHaramKm({ lat: pos.lat, lng: pos.lng }),
      });
    });

    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; external coordinate changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker in sync when the form's lat/lng change externally.
  useEffect(() => {
    if (lat == null || lng == null) return;
    markerRef.current?.setLngLat([lng, lat]);
    mapRef.current?.easeTo({ center: [lng, lat], duration: 400 });
  }, [lat, lng]);

  const applyExif = () => {
    if (!exifSuggestion) return;
    onChangeRef.current({
      lat: exifSuggestion.lat,
      lng: exifSuggestion.lng,
      suggestedKm: distanceFromHaramKm(exifSuggestion),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-base text-muted">{t("dragHint")}</p>
      <div
        ref={containerRef}
        className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink/10"
        role="application"
        aria-label={t("title")}
      />
      {exifSuggestion && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] border-accent bg-sand p-3">
          <p className="min-w-0 flex-1 text-base">{t("exifFound")}</p>
          <button
            type="button"
            onClick={applyExif}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-4 font-medium text-paper"
          >
            <Crosshair aria-hidden="true" className="h-5 w-5" />
            {t("useExif")}
          </button>
        </div>
      )}
    </div>
  );
}
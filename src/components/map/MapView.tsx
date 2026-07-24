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
import { createClient } from "@/lib/supabase/client";
import { stripVerify } from "@/lib/content";
import { MADINAH_BOUNDS, MADINAH_CENTER } from "@/lib/geo";
import { CATEGORY_META, CATEGORY_ORDER, MAP_STYLE_URL } from "@/lib/maps";
import {
  applyArabicLabels,
  createPinElement,
  ensureRtlTextPlugin,
} from "./map-utils";
import { MapBottomSheet, type MapPlacePreview } from "./MapBottomSheet";

/** Full-screen category-pinned map of all published places. */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [places, setPlaces] = useState<MapPlacePreview[] | null>(null);
  const [selected, setSelected] = useState<MapPlacePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations("map");

  // Fetch pins once (RLS: anon sees published only). Coordinates stay on a
  // parallel list keyed by index so the preview DTO stays serializable-lean.
  const coordsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("places")
      .select(
        "slug,name_ar,category,summary_ar,lat,lng,distance_from_prophets_mosque_km,media(url,thumb_url,width,height,type,sort_order)"
      )
      .eq("is_published", true)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .then(({ data, error }) => {
        if (error || !data) {
          setPlaces([]);
          return;
        }
        const dtos: MapPlacePreview[] = data.map((p) => {
          coordsRef.current.set(p.slug, { lat: Number(p.lat), lng: Number(p.lng) });
          const photo = [...(p.media ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .find((m) => m.type === "photo");
          return {
            slug: p.slug,
            name_ar: p.name_ar,
            category: p.category,
            summary: stripVerify(p.summary_ar),
            distanceKm:
              p.distance_from_prophets_mosque_km != null
                ? Number(p.distance_from_prophets_mosque_km)
                : null,
            thumb:
              photo?.thumb_url && photo.width && photo.height
                ? { url: photo.thumb_url, width: photo.width, height: photo.height }
                : null,
          };
        });
        setPlaces(dtos);
      });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureRtlTextPlugin();

    const map = new MaplibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [MADINAH_CENTER.lng, MADINAH_CENTER.lat],
      zoom: 12,
      minZoom: 10,
      maxBounds: MADINAH_BOUNDS,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");
    map.addControl(new GeolocateControl({ trackUserLocation: false }), "top-left");
    map.on("load", () => {
      applyArabicLabels(map);
      setLoading(false);
    });
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add markers once both the map and the data exist.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !places) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = places.flatMap((p) => {
      const coords = coordsRef.current.get(p.slug);
      if (!coords) return [];
      const el = createPinElement(CATEGORY_META[p.category].color, p.name_ar);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(p);
      });
      return [
        new Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map),
      ];
    });
  }, [places]);

  return (
    <div className="relative h-[calc(100dvh-8rem)] w-full">
      {loading && (
        <p
          role="status"
          className="absolute inset-0 z-10 flex items-center justify-center bg-sand text-lg text-muted"
        >
          {t("loading")}
        </p>
      )}
      <div ref={containerRef} className="h-full w-full" aria-label={t("title")} />
      <details className="absolute end-2 top-2 z-10 rounded-xl border border-basalt/10 bg-surface/95 p-2 text-sm shadow-sm">
        <summary className="flex min-h-10 cursor-pointer items-center px-1 font-semibold">
          {t("legend")}
        </summary>
        <ul className="mt-1 space-y-1 px-1">
          {CATEGORY_ORDER.filter((c) => c !== "other").map((c) => (
            <li key={c} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full border-2 border-surface shadow"
                style={{ backgroundColor: CATEGORY_META[c].color }}
              />
              <span>{CATEGORY_META[c].labelAr}</span>
            </li>
          ))}
        </ul>
      </details>
      <MapBottomSheet place={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
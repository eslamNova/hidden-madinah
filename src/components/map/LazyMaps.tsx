"use client";

import dynamic from "next/dynamic";

function MapSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-basalt/10"
    />
  );
}

/**
 * Client-side lazy wrappers so maplibre-gl (~250 kB) stays out of the initial
 * bundle of place/route pages — it loads only when the map scrolls into use.
 */
export const PlaceMapLazy = dynamic(
  () => import("./PlaceMap").then((m) => m.PlaceMap),
  { ssr: false, loading: MapSkeleton }
);

export const RouteMapLazy = dynamic(
  () => import("./RouteMap").then((m) => m.RouteMap),
  { ssr: false, loading: MapSkeleton }
);